import { addIcon, App, Notice, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface BookmarkBasicItem {
	ctime: number;
	type: unknown;
}

interface BookmarkFileItem extends BookmarkBasicItem {
	type: "file";
	path: string;
	title?: string;
}

interface BookmarkFolderItem extends BookmarkBasicItem {
	type: "folder";
	path: string;
	title?: string;
}

interface BookmarkGroupItem {
	type: "group";
	title: string;
	items: BookmarkItem[]
}

type BookmarkItem = BookmarkFileItem | BookmarkGroupItem | BookmarkFolderItem;

interface SummaryBasicItem {
	type: unknown;
	title: string;

}

interface SummaryFileItem extends SummaryBasicItem {
	type: "file"
	path: string;
}

interface SummaryFloderItem extends SummaryBasicItem {
	type: "floder"
	itmes: SummaryItem[]
}

type SummaryItem = SummaryFloderItem | SummaryFileItem;

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	summaryPath: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	summaryPath: 'SUMMARY.md'
}
const fileSummarySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <path fill="currentColor" d="M20.71,6.29L15.71,1.29c-.19-.19-.44-.29-.71-.29H6c-1.65,0-3,1.35-3,3v16c0,1.65,1.35,3,3,3h12c1.65,0,3-1.35,3-3V7c0-.27-.11-.52-.29-.71ZM18.59,7h-2.59c-.55,0-1-.45-1-1v-2.59l3.59,3.59ZM18,21H6c-.55,0-1-.45-1-1V4c0-.55.45-1,1-1h7v3c0,1.65,1.35,3,3,3h3v11c0,.55-.45,1-1,1Z"/>
  <path fill="currentColor" d="M13.57,14.6c-.34-.16-.98-.34-1.9-.55s-1.5-.41-1.71-.61c-.22-.2-.33-.45-.33-.76,0-.36.16-.66.47-.91s.81-.38,1.5-.38,1.16.14,1.5.42.54.69.59,1.23l1.09-.08c-.02-.5-.16-.96-.42-1.35s-.63-.7-1.12-.91-1.05-.31-1.69-.31c-.58,0-1.1.1-1.58.29s-.83.48-1.08.86-.37.78-.37,1.22c0,.39.1.75.3,1.07s.51.58.92.8c.32.17.87.35,1.66.54s1.3.33,1.53.42c.36.14.62.31.77.51s.23.44.23.71-.08.51-.24.74-.41.4-.74.53-.71.19-1.15.19c-.49,0-.93-.08-1.32-.25-.39-.17-.68-.39-.86-.67s-.3-.63-.35-1.06l-1.07.09c.02.57.17,1.09.47,1.54s.71.8,1.24,1.02,1.18.34,1.95.34c.61,0,1.17-.11,1.66-.34s.87-.54,1.13-.94.39-.83.39-1.29-.12-.87-.36-1.22-.61-.65-1.11-.88Z"/>
</svg>`

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;

	async onload() {
		await this.loadSettings();
		addIcon('file-summary', fileSummarySvg)

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('file-summary', 'Summary Generator', async (evt: MouseEvent) => {
			if (ribbonIconEl.classList.contains("generating")) {
				return;
			}
			ribbonIconEl.addClass("generating")
			const loadingNotice = new Notice('Summary generating...', 0);
			try {
				await this.generateSummary();
				new Notice('Summary generated successfully!')
			} catch (error) {
				new Notice(`Error: ${error.message}`)
			}
			loadingNotice.hide()


			ribbonIconEl.removeClass("generating")
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('ribbon-summary-generator');

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async generateSummary() {
		const bookmarks: BookmarkItem[] = (this.app as any).internalPlugins?.getEnabledPluginById("bookmarks")?.items
		if (!Array.isArray(bookmarks)) {
			throw new Error('获取书签列表失败')
		}

		const summarys = this.parseBookmark(bookmarks);

		const markdownContent = this.summaryMarkdown(summarys)

		const summaryFile = this.app.vault.getFileByPath(this.settings.summaryPath);
		if (summaryFile) {
			await this.app.vault.modify(summaryFile, markdownContent)
		} else {
			await this.app.vault.create(this.settings.summaryPath, markdownContent)
		}
	}

	private isMarkdown(path: string): boolean {
		const index = path.lastIndexOf('.');
		if (index === -1) {
			return false;
		}

		const ext = path.substring(index).toLowerCase();
		return ext === '.md'
	}

	private basename(path: string): string {
		const index = path.lastIndexOf('/');
		if (index === -1) {
			return path
		}

		return path.substring(index + 1)
	}

	private parseBookmark(bookmarks: BookmarkItem[]): SummaryItem[] {
		const parse = (bookmark: BookmarkItem): SummaryItem | null => {
			if (bookmark.type === 'file') {
				if (this.isMarkdown(bookmark.path)) {
					let title = bookmark.title;
					if (!title) {
						const name = this.basename(bookmark.path);
						title = name.substring(0, name.length - 3)
					}
					return {
						type: 'file',
						title: title,
						path: bookmark.path,

					};
				}
				return null;
			}
			if (bookmark.type === 'group') {
				const items: SummaryItem[] = []
				bookmark.items.forEach(v => {
					const subItem = parse(v);
					if (subItem) {
						items.push(subItem)
					}
				})

				return {
					type: 'floder',
					title: bookmark.title,
					itmes: items,

				};
			}
			return null;
		}

		const results: SummaryItem[] = [];

		bookmarks.forEach(bookmark => {
			const item = parse(bookmark)
			if (item) {
				results.push(item)
			}
		})
		return results
	}

	private summaryMarkdown(summarys: SummaryItem[]): string {
		let md = '# Summary\n\n'

		const parse = (item: SummaryItem, level: number) => {
			if (item.type === 'file') {
				const padStart = ''.padStart(level * 4, ' ')
				md += `${padStart}- [${item.title}](${encodeURI(item.path)})\n`
				return;
			}
			if (item.type === 'floder') {
				const padStart = ''.padStart(level * 4, ' ')
				md += `${padStart}- ${item.title}\n`
				item.itmes.forEach(v => {
					parse(v, level + 1)
				})
			}

		}
		summarys.forEach(v => {
			parse(v, 0)
		})
		return md
	}
}


class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Output Path')
			.setDesc('Path to generate SUMMARY.md')
			.addText(text => text
				.setPlaceholder('SUMMARY.md')
				.setValue(this.plugin.settings.summaryPath)
				.onChange(async (value) => {
					this.plugin.settings.summaryPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
