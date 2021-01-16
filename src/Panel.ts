import * as vscode from "vscode";

export class Panel {
    /**
     * Track the currently panel. Only allow a single panel to exist at a time.
     */
    public static currentPanel: Panel | undefined;

    public static readonly viewType = "hello";

    private readonly _styleUri: string;
    private readonly _scriptUri: string;
    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    // creating or showing the panel
    public static createOrShow(extensionUri: vscode.Uri, styleUri: string, scriptUri: string) {
        // is there an active text editor going on rn?
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it.
        if (Panel.currentPanel) {
            Panel.currentPanel._panel.reveal(column);
            Panel.currentPanel._update();
            return;
        }

        // Otherwise, create a new panel.
        const panel = vscode.window.createWebviewPanel(
            Panel.viewType,
            "Panel",
            column || vscode.ViewColumn.One,
            {
                // Enable javascript in the webview
                enableScripts: true,

                // And restrict the webview to only loading content from our extension's `media` directory.
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, "media"),
                    vscode.Uri.joinPath(extensionUri, "out"),
                ],
            }
        );

        Panel.currentPanel = new Panel(panel, extensionUri, styleUri, scriptUri);
    }

    public refactor(msg: Object) {
        this._panel.webview.postMessage({msg});
    }

    // killing the panel
    public static kill() {
        Panel.currentPanel?.dispose();
        Panel.currentPanel = undefined;
    }

    // when doing a new one
    public static revive(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, styleUri: string, scriptUri: string) {
        Panel.currentPanel = new Panel(panel, extensionUri, styleUri, scriptUri);
    }

    public constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, styleUri: string, scriptUri: string) {
        this._panel = panel;
        this._extensionUri = extensionUri;
        this._styleUri = styleUri;
        this._scriptUri = scriptUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    }

    // function that cleans up resources and closes the panel
    public dispose() {
        Panel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    // what to do to update the view
    private async _update() {
        // sets a webview
        const webview = this._panel.webview;

        // sets the html of the webview
        this._panel.webview.html = this._getHtmlForWebview(webview);

        // on receiving a message --- don't know what this is yet, does something
        webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case "onInfo": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showInformationMessage(data.value);
                    break;
                }
                case "onError": {
                    if (!data.value) {
                        return;
                    }
                    vscode.window.showErrorMessage(data.value);
                    break;
                }
            }
        });
    }

    //   so this here gets the actual files it needs for the extension
    private _getHtmlForWebview(webview: vscode.Webview) {

        const scriptUri = webview.asWebviewUri( 
            vscode.Uri.joinPath(this._extensionUri, "out", this._scriptUri)
        );

        const stylesheetUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, "media", this._styleUri)
        );

        const nonce = getNonce(); // creates a unique id

        // the following is an html element which is essentially the web view itself
        return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
                <meta http-equiv="Content-Security-Policy" content="img-src https: data:; style-src 'unsafe-inline' ${webview.cspSource}; ">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${stylesheetUri}" rel="stylesheet">
            <script nonce="${nonce}"> </script>
			</head>
            <body id="target">
            </body>
            <script src="${scriptUri}" nonce="${nonce}"></script>
        </html>`;

        // everytime a src folder gets edited, you need to reload the entire window
        // for compiled, only the extension
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}