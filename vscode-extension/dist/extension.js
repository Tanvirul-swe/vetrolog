"use strict";var U=Object.create;var P=Object.defineProperty;var $=Object.getOwnPropertyDescriptor;var H=Object.getOwnPropertyNames;var q=Object.getPrototypeOf,W=Object.prototype.hasOwnProperty;var Q=(o,e)=>{for(var t in e)P(o,t,{get:e[t],enumerable:!0})},V=(o,e,t,n)=>{if(e&&typeof e=="object"||typeof e=="function")for(let r of H(e))!W.call(o,r)&&r!==t&&P(o,r,{get:()=>e[r],enumerable:!(n=$(e,r))||n.enumerable});return o};var m=(o,e,t)=>(t=o!=null?U(q(o)):{},V(e||!o||!o.__esModule?P(t,"default",{value:o,enumerable:!0}):t,o)),j=o=>V(P({},"__esModule",{value:!0}),o);var K={};Q(K,{activate:()=>N,deactivate:()=>z});module.exports=j(K);var s=m(require("vscode"));var f=m(require("vscode")),E=require("child_process"),I=m(require("http")),h=m(require("path")),k=m(require("fs")),B=m(require("os")),D=class{process=null;outputChannel;currentPort=8787;isStarting=!1;onStatusChangeEmitter=new f.EventEmitter;onStatusChange=this.onStatusChangeEmitter.event;constructor(){this.outputChannel=f.window.createOutputChannel("VetroLog Daemon");let e=f.workspace.getConfiguration("vetrolog");this.currentPort=e.get("serverPort",8787)}getPort(){return this.currentPort}getBaseUrl(){return`http://localhost:${this.currentPort}`}async checkHealth(e=this.currentPort){return new Promise(t=>{let n=I.get(`http://localhost:${e}/api/status`,{timeout:1500},r=>{r.statusCode===200?t(!0):t(!1)});n.on("error",()=>t(!1)),n.on("timeout",()=>{n.destroy(),t(!1)})})}findBinary(){let t=f.workspace.getConfiguration("vetrolog").get("customBinaryPath","").trim();if(t&&k.existsSync(t))return t;let n=process.platform==="win32",r=n?"vetrolog.exe":"vetrolog",i=f.workspace.workspaceFolders||[];for(let c of i){let y=[h.join(c.uri.fsPath,"build","bin",r),h.join(c.uri.fsPath,"build","bin","vetrolog.app","Contents","MacOS","vetrolog"),h.join(c.uri.fsPath,r)];for(let S of y)if(k.existsSync(S))return S}let d=B.homedir(),v=n?[h.join(d,"go","bin",r),`C:\\Program Files\\VetroLog\\${r}`,`C:\\Program Files (x86)\\VetroLog\\${r}`,h.join(process.env.LOCALAPPDATA||"","Programs","VetroLog",r)]:["/usr/local/bin/vetrolog","/opt/homebrew/bin/vetrolog","/usr/bin/vetrolog","/snap/bin/vetrolog",h.join(d,".local","bin","vetrolog"),h.join(d,"go","bin","vetrolog"),"/Applications/VetroLog.app/Contents/MacOS/vetrolog",h.join(d,"Applications/VetroLog.app/Contents/MacOS/vetrolog")];for(let c of v)if(k.existsSync(c))return c;let a=(process.env.PATH||"").split(h.delimiter);for(let c of a){let y=h.join(c,r);if(k.existsSync(y))return y}return null}async startServer(){if(this.isStarting)return!1;if(this.isStarting=!0,await this.checkHealth(this.currentPort))return this.outputChannel.appendLine(`[Daemon] Existing VetroLog instance detected on port ${this.currentPort}`),this.isStarting=!1,this.notifyStatus(!0),!0;let t=this.findBinary();if(!t)return this.outputChannel.appendLine("[Daemon Error] Could not find vetrolog executable binary."),this.outputChannel.appendLine('Please install VetroLog or specify "vetrolog.customBinaryPath" in settings.'),this.isStarting=!1,this.notifyStatus(!1,"Binary not found. Please install VetroLog."),!1;this.outputChannel.appendLine(`[Daemon] Launching ${t} on port ${this.currentPort}...`);try{this.process=(0,E.spawn)(t,["--web",`--port=${this.currentPort}`,"--no-browser"],{detached:!1,env:{...process.env}}),this.process.stdout?.on("data",r=>{this.outputChannel.append(`[VetroLog] ${r.toString()}`)}),this.process.stderr?.on("data",r=>{this.outputChannel.append(`[VetroLog Error] ${r.toString()}`)}),this.process.on("close",r=>{this.outputChannel.appendLine(`[Daemon] Process exited with code ${r}`),this.process=null,this.notifyStatus(!1)});let n=Date.now();for(;Date.now()-n<1e4;)if(await new Promise(i=>setTimeout(i,400)),await this.checkHealth(this.currentPort))return this.outputChannel.appendLine(`[Daemon] Verified running at ${this.getBaseUrl()}`),this.isStarting=!1,this.notifyStatus(!0),!0;return this.outputChannel.appendLine("[Daemon Warning] Server health check timed out."),this.isStarting=!1,!1}catch(n){return this.outputChannel.appendLine(`[Daemon Error] Failed to spawn process: ${n.message}`),this.isStarting=!1,this.notifyStatus(!1,n.message),!1}}stopServer(){this.process&&(this.outputChannel.appendLine("[Daemon] Terminating process..."),this.process.kill("SIGTERM"),this.process=null,this.notifyStatus(!1))}async restartServer(){return this.stopServer(),await new Promise(e=>setTimeout(e,600)),this.startServer()}notifyStatus(e,t){this.onStatusChangeEmitter.fire({isRunning:e,port:this.currentPort,url:this.getBaseUrl(),error:t})}dispose(){this.stopServer(),this.outputChannel.dispose(),this.onStatusChangeEmitter.dispose()}};var p=m(require("vscode")),w=class o{static currentPanel;panel;extensionUri;serverManager;disposables=[];static async createOrShow(e,t,n=p.ViewColumn.One,r="/"){if(o.currentPanel)return o.currentPanel.panel.reveal(n),r!=="/"&&o.currentPanel.navigate(r),o.currentPanel;let i=p.window.createWebviewPanel("vetrologStudio","VetroLog Database Studio",n,{enableScripts:!0,retainContextWhenHidden:!0,localResourceRoots:[e]});return o.currentPanel=new o(i,e,t,r),o.currentPanel}constructor(e,t,n,r="/"){this.panel=e,this.extensionUri=t,this.serverManager=n,this.updateContent(r),this.panel.onDidDispose(()=>this.dispose(),null,this.disposables),p.window.onDidChangeActiveColorTheme(()=>{this.updateTheme()},null,this.disposables),this.serverManager.onStatusChange(()=>{this.updateContent(r)},null,this.disposables),this.panel.webview.onDidReceiveMessage(async i=>{switch(i.command){case"startServer":await this.serverManager.startServer(),this.updateContent();break;case"openSettings":p.commands.executeCommand("workbench.action.openSettings","vetrolog");break;case"showInfo":p.window.showInformationMessage(i.text);break;case"showError":p.window.showErrorMessage(i.text);break}},null,this.disposables)}navigate(e){let t=e;if(e.includes("mode=adb")?t="adb":e.includes("view=diagram")?t="diagram":e.includes("view=playground")?t="playground":e.includes("view=grid")&&(t="grid"),this.panel.webview.postMessage({type:"navigate",action:t,path:e}),e.includes("file="))try{let r=new URLSearchParams(e.replace(/^\/?\?/,"")).get("file");r&&this.openFile(r)}catch{}}openFile(e){this.panel.webview.postMessage({type:"openFile",filePath:e})}getActiveTheme(){let e=p.window.activeColorTheme.kind;return e===p.ColorThemeKind.Light||e===p.ColorThemeKind.HighContrastLight?"light":"dark"}updateTheme(){this.panel.webview.postMessage({type:"themeChange",theme:this.getActiveTheme()})}async updateContent(e="/"){let t=await this.serverManager.checkHealth(),n=this.getActiveTheme(),r=`${this.serverManager.getBaseUrl()}${e}`;t?this.panel.webview.html=this.getIframeHtml(r,n):this.panel.webview.html=this.getOfflineHtml()}getIframeHtml(e,t){return`<!DOCTYPE html>
<html lang="en" class="${t}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* http://127.0.0.1:*; img-src vscode-resource: https: http: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VetroLog Studio</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--vscode-editor-background, #0B0F19);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe 
    src="${e}" 
    allow="clipboard-read; clipboard-write;"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads">
  </iframe>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', event => {
      const msg = event.data;
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(msg, '*');
      }
    });
  </script>
</body>
</html>`}getOfflineHtml(){return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* http://127.0.0.1:*; img-src vscode-resource: https: http: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VetroLog Offline</title>
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      padding: 2.5rem;
      background-color: var(--vscode-editor-background, #0B0F19);
      color: var(--vscode-editor-foreground, #E2E8F0);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 80vh;
      text-align: center;
    }
    .icon {
      font-size: 3.5rem;
      margin-bottom: 1rem;
    }
    h2 {
      margin-top: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }
    p {
      max-width: 480px;
      color: var(--vscode-descriptionForeground, #94A3B8);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .btn {
      background-color: var(--vscode-button-background, #0284C7);
      color: var(--vscode-button-foreground, #FFFFFF);
      border: none;
      padding: 0.6rem 1.25rem;
      font-size: 0.9rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background-color: transparent;
      color: var(--vscode-textLink-foreground, #38BDF8);
      border: 1px solid var(--vscode-button-secondaryBorder, #334155);
      margin-left: 0.5rem;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="icon">\u{1F50C}</div>
  <h2>VetroLog Daemon Offline</h2>
  <p>
    The background database engine is not running on port <strong>${this.serverManager.getPort()}</strong>. 
    Click below to launch the local daemon or configure your custom binary path.
  </p>
  <div class="actions">
    <button class="btn" onclick="startServer()">Launch VetroLog Daemon</button>
    <button class="btn btn-secondary" onclick="openSettings()">Configure Settings</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function startServer() {
      const btn = document.querySelector('.btn');
      btn.innerText = 'Starting daemon...';
      btn.disabled = true;
      vscode.postMessage({ command: 'startServer' });
    }
    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }
  </script>
</body>
</html>`}dispose(){for(o.currentPanel=void 0,this.panel.dispose();this.disposables.length;){let e=this.disposables.pop();e&&e.dispose()}}};var u=m(require("vscode")),L=m(require("path")),T=class o{constructor(e,t){this.context=e;this.serverManager=t}static viewType="vetrolog.dbEditor";static register(e,t){let n=new o(e,t);return u.window.registerCustomEditorProvider(o.viewType,n,{webviewOptions:{retainContextWhenHidden:!0,enableFindWidget:!0},supportsMultipleEditorsPerDocument:!1})}async openCustomDocument(e,t,n){return{uri:e,dispose:()=>{}}}async resolveCustomEditor(e,t,n){t.webview.options={enableScripts:!0,enableForms:!0,localResourceRoots:[this.context.extensionUri]};let r=e.uri.fsPath,i=async()=>{let g=await this.serverManager.checkHealth(),R=this.getActiveTheme();if(!g)t.webview.html=this.getOfflineHtml();else{let A=encodeURIComponent(r),O=`${this.serverManager.getBaseUrl()}/?file=${A}`;t.webview.html=this.getHtmlForWebview(O,R,r)}};await this.serverManager.checkHealth()||await this.serverManager.startServer(),await i();let v=u.window.onDidChangeActiveColorTheme(()=>{t.webview.postMessage({type:"themeChange",theme:this.getActiveTheme()})}),a=this.serverManager.onStatusChange(g=>{g.isRunning&&i()}),c=t.webview.onDidReceiveMessage(async g=>{g.command==="startServer"?(await this.serverManager.startServer(),await i()):g.command==="openSettings"&&u.commands.executeCommand("workbench.action.openSettings","vetrolog")}),y=L.dirname(r),S=L.basename(r),F=u.workspace.createFileSystemWatcher(new u.RelativePattern(y,S));F.onDidChange(()=>{t.webview.postMessage({type:"fileChanged",filePath:r})}),t.onDidDispose(()=>{v.dispose(),a.dispose(),c.dispose(),F.dispose()})}getActiveTheme(){let e=u.window.activeColorTheme.kind;return e===u.ColorThemeKind.Light||e===u.ColorThemeKind.HighContrastLight?"light":"dark"}getHtmlForWebview(e,t,n){let r=L.basename(n)||"database";return`<!DOCTYPE html>
<html lang="en" class="${t}">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* http://127.0.0.1:*; img-src vscode-resource: https: http: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${r} \u2014 VetroLog</title>
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: var(--vscode-editor-background, #0B0F19);
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
  </style>
</head>
<body>
  <iframe 
    src="${e}" 
    allow="clipboard-read; clipboard-write;"
    sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads">
  </iframe>
  <script>
    const vscode = acquireVsCodeApi();
    window.addEventListener('message', (event) => {
      const msg = event.data;
      const iframe = document.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(msg, '*');
      }
    });
  </script>
</body>
</html>`}getOfflineHtml(){return`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src http://localhost:* http://127.0.0.1:*; img-src vscode-resource: https: http: data:; style-src 'unsafe-inline' vscode-resource:; script-src 'unsafe-inline' vscode-resource:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>VetroLog Offline</title>
  <style>
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif);
      padding: 2.5rem;
      background-color: var(--vscode-editor-background, #0B0F19);
      color: var(--vscode-editor-foreground, #E2E8F0);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 80vh;
      text-align: center;
    }
    .icon {
      font-size: 3.5rem;
      margin-bottom: 1rem;
    }
    h2 {
      margin-top: 0;
      font-size: 1.5rem;
      font-weight: 600;
    }
    p {
      max-width: 480px;
      color: var(--vscode-descriptionForeground, #94A3B8);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }
    .btn {
      background-color: var(--vscode-button-background, #0284C7);
      color: var(--vscode-button-foreground, #FFFFFF);
      border: none;
      padding: 0.6rem 1.25rem;
      font-size: 0.9rem;
      font-weight: 500;
      border-radius: 6px;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .btn-secondary {
      background-color: transparent;
      color: var(--vscode-textLink-foreground, #38BDF8);
      border: 1px solid var(--vscode-button-secondaryBorder, #334155);
      margin-left: 0.5rem;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
    }
  </style>
</head>
<body>
  <div class="icon">\u{1F50C}</div>
  <h2>VetroLog Daemon Offline</h2>
  <p>
    The background database engine is not running on port <strong>${this.serverManager.getPort()}</strong>. 
    Click below to launch the local daemon to inspect this SQLite file.
  </p>
  <div class="actions">
    <button class="btn" onclick="startServer()">Launch VetroLog Daemon</button>
    <button class="btn btn-secondary" onclick="openSettings()">Configure Settings</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    function startServer() {
      const btn = document.querySelector('.btn');
      btn.innerText = 'Starting daemon...';
      btn.disabled = true;
      vscode.postMessage({ command: 'startServer' });
    }
    function openSettings() {
      vscode.postMessage({ command: 'openSettings' });
    }
  </script>
</body>
</html>`}};var l=m(require("vscode")),C=class extends l.TreeItem{constructor(t,n,r,i,d){super(t,l.TreeItemCollapsibleState.None);this.label=t;this.commandId=n;this.iconName=r;this.description=i;this.tooltip=d;this.iconPath=new l.ThemeIcon(r),this.tooltip=d||t,this.description=i,this.command={command:n,title:t}}},M=class{_onDidChangeTreeData=new l.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;refresh(){this._onDidChangeTreeData.fire()}getTreeItem(e){return e}getChildren(){return Promise.resolve([new C("Open Database Studio","vetrolog.open","database","Full Studio","Launch VetroLog Database Studio webview"),new C("Scan ADB Devices & Apps","vetrolog.connectADB","device-mobile","Mobile Inspector","Inspect live SQLite databases on Android / Flutter / React Native"),new C("Interactive ER Diagram","vetrolog.openERDiagram","type-hierarchy","Visual Schema","Open visual schema map with interactive foreign key flows"),new C("New SQL Query","vetrolog.newQuery","terminal","SQL Playground","Execute ad-hoc queries with auto-complete and safety simulation"),new C("Open SQLite File...","vetrolog.openFile","file-submodule","Local File","Select a SQLite file (.db, .sqlite, .db3) from your filesystem")])}},b=class extends l.TreeItem{constructor(t,n,r,i,d){super(t,l.TreeItemCollapsibleState.None);this.label=t;this.iconName=n;this.description=r;this.tooltip=i;this.command=d;this.iconPath=new l.ThemeIcon(n),this.description=r,this.tooltip=i||t}},x=class{constructor(e){this.serverManager=e;this.currentPort=e.getPort(),e.onStatusChange(t=>{this.isRunning=t.isRunning,this.currentPort=t.port,this.refresh()}),this.serverManager.checkHealth().then(t=>{this.isRunning=t,this.refresh()})}_onDidChangeTreeData=new l.EventEmitter;onDidChangeTreeData=this._onDidChangeTreeData.event;isRunning=!1;currentPort=8787;refresh(){this._onDidChangeTreeData.fire()}getTreeItem(e){return e}async getChildren(){let e=await this.serverManager.checkHealth();this.isRunning=e;let t=this.serverManager.findBinary(),n=[];if(this.isRunning?(n.push(new b("Status: Active","check",`Port ${this.currentPort}`,`VetroLog daemon is running at ${this.serverManager.getBaseUrl()}`)),n.push(new b("URL","globe",this.serverManager.getBaseUrl(),"Click to open in browser",{command:"vscode.open",title:"Open in Browser",arguments:[l.Uri.parse(this.serverManager.getBaseUrl())]}))):n.push(new b("Status: Stopped","circle-slash","Offline","VetroLog daemon is not currently running")),t){let r=t.length>35?"..."+t.slice(-32):t;n.push(new b("CLI Binary","file-binary",r,`Binary: ${t}`))}else n.push(new b("CLI Binary: Not Found","warning","Install VetroLog","VetroLog binary was not detected on system PATH. Click to open settings.",{command:"workbench.action.openSettings",title:"Open Settings",arguments:["vetrolog.customBinaryPath"]}));return n.push(new b(this.isRunning?"Restart Local Daemon":"Start Local Daemon","refresh","","Start or restart background database daemon",{command:this.isRunning?"vetrolog.restartServer":"vetrolog.startServer",title:"Restart Daemon"})),n}};async function N(o){let e=new D;o.subscriptions.push(e);let t=s.window.createStatusBarItem(s.StatusBarAlignment.Right,100);t.command="vetrolog.open",t.text="$(database) VetroLog",t.tooltip="Click to open VetroLog Database Studio",t.show(),o.subscriptions.push(t),e.onStatusChange(a=>{a.isRunning?(t.text="$(database) VetroLog: Active",t.tooltip=`VetroLog Studio connected on port ${a.port}`):(t.text="$(database) VetroLog: Offline",t.tooltip="VetroLog daemon is stopped. Click to launch.")}),s.workspace.getConfiguration("vetrolog").get("autoStartServer",!0)&&e.startServer().catch(a=>{console.warn("[VetroLog] Auto-start daemon encountered an issue:",a)}),o.subscriptions.push(T.register(o,e));let i=new M,d=new x(e);o.subscriptions.push(s.window.registerTreeDataProvider("vetrolog.quickActions",i)),o.subscriptions.push(s.window.registerTreeDataProvider("vetrolog.serverStatus",d));let v=async()=>await e.checkHealth()?!0:await e.startServer();o.subscriptions.push(s.commands.registerCommand("vetrolog.open",async()=>{await v(),await w.createOrShow(o.extensionUri,e)})),o.subscriptions.push(s.commands.registerCommand("vetrolog.connectADB",async()=>{await v(),(await w.createOrShow(o.extensionUri,e,s.ViewColumn.One,"/?mode=adb")).navigate("/?mode=adb")})),o.subscriptions.push(s.commands.registerCommand("vetrolog.openERDiagram",async()=>{await v(),(await w.createOrShow(o.extensionUri,e,s.ViewColumn.One,"/?view=diagram")).navigate("/?view=diagram")})),o.subscriptions.push(s.commands.registerCommand("vetrolog.newQuery",async()=>{await v(),(await w.createOrShow(o.extensionUri,e,s.ViewColumn.One,"/?view=playground")).navigate("/?view=playground")})),o.subscriptions.push(s.commands.registerCommand("vetrolog.openFile",async a=>{let c;if(a&&a.fsPath)c=a.fsPath;else{let g=await s.window.showOpenDialog({canSelectFiles:!0,canSelectFolders:!1,canSelectMany:!1,openLabel:"Inspect Database",filters:{"SQLite Databases":["db","sqlite","sqlite3","db3","wal"],"All Files":["*"]}});g&&g.length>0&&(c=g[0].fsPath)}if(!c)return;await v();let S=`/?file=${encodeURIComponent(c)}`;(await w.createOrShow(o.extensionUri,e,s.ViewColumn.One,S)).navigate(S)})),o.subscriptions.push(s.commands.registerCommand("vetrolog.startServer",async()=>{await e.startServer()?s.window.showInformationMessage(`VetroLog daemon active at ${e.getBaseUrl()}`):s.window.showErrorMessage("Failed to start VetroLog daemon. Check VetroLog Daemon output channel."),d.refresh()})),o.subscriptions.push(s.commands.registerCommand("vetrolog.stopServer",()=>{e.stopServer(),s.window.showInformationMessage("VetroLog daemon stopped."),d.refresh()})),o.subscriptions.push(s.commands.registerCommand("vetrolog.restartServer",async()=>{s.window.showInformationMessage("Restarting VetroLog daemon..."),await e.restartServer()?s.window.showInformationMessage(`VetroLog daemon restarted at ${e.getBaseUrl()}`):s.window.showErrorMessage("Failed to restart VetroLog daemon."),d.refresh()}))}function z(){}0&&(module.exports={activate,deactivate});
