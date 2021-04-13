import { App, EditorPosition, MarkdownView } from "obsidian";
import { escapeRegExp } from "Utils";

export class CursorJumper {
    private cursor_regex = new RegExp("<%\\s*tp.file.cursor\\((?<order>[0-9]{0,2})\\)\\s*%>", "g");	

    constructor(private app: App) {}

    async jump_to_next_cursor_location() {
        let active_view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (active_view === null) {
            throw new Error("No active view, can't append templates.");
        }
        let active_file = active_view.file;
        await active_view.save();

        let content = await this.app.vault.read(active_file);

        const {match_string, positions} = this.get_cursor_position(content);
        if (positions) {
            content = content.replace(new RegExp(escapeRegExp(match_string), "g"), "");
            await this.app.vault.modify(active_file, content);
            this.set_cursor_location(positions);
        }
    }

    get_cursor_position(content: string) {
        let cursor_matches = [];
        let match;
        while((match = this.cursor_regex.exec(content)) != null) {
            cursor_matches.push(match);
        }
        if (cursor_matches.length === 0) {
            return {};
        }

        cursor_matches.sort((m1, m2) => {
            return Number(m1.groups["order"]) - Number(m2.groups["order"]);
        });
        let match_str = cursor_matches[0][0];

        cursor_matches = cursor_matches.filter(m => {
            return m[0] === match_str;
        });

        let positions = [];
        for (let match of cursor_matches) {
            let index = match.index;
            let substr = content.substr(0, index);

            let l = 0;
            let offset = -1;
            let r = -1;
            for (; (r = substr.indexOf("\n", r+1)) !== -1 ; l++, offset=r);
            offset += 1;

            let ch = content.substr(offset, index-offset).length;
            positions.push({line: l, ch: ch});
        }

        return {match_string: match_str, positions: positions};
    }

    set_cursor_location(positions: Array<EditorPosition>) {
        let active_view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (active_view === null) {
            return;
        }
        //let editor = active_view.editor;
        let editor = active_view.sourceMode.cmEditor;

        let selections = [];
        for (let pos of positions) {
            selections.push({anchor: pos, head: pos});
        }
        editor.focus();
        editor.setSelections(selections);
    }
}