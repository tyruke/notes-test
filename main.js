const { app, BrowserWindow, Menu, ipcMain } = require("electron");
const path = require('path');

let fontPath;
if (app.isPackaged) {
  fontPath = path.join(app.getAppPath('exe'), './fonts');
} else {
  fontPath = path.join(__dirname, './fonts');
}

let dbPath;
if (app.isPackaged) {
  dbPath = path.join(app.getAppPath(), 'my-databse.db');
} else {
  dbPath = path.join(__dirname, 'my-databse.db');
}

function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 440,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  win.setMinimumSize(400, 440);

  win.loadFile("index.html").catch(function(e) {
    console.error('Failed to load app:', e);
  });

  // Enable the default context menu
  win.webContents.on("context-menu", function(event, params) {
    const menu = Menu.buildFromTemplate([
      { role: "cut" },
      { role: "copy" },
      { role: "paste" },
      { type: "separator" },
      { role: "selectAll" },
    ]);
    menu.popup(win, params.x, params.y);
  });
}

app.whenReady().then(createWindow).catch(function(e) {
  console.error('Failed to create window:', e);
});

ipcMain.on('minimize-window', function() {
  BrowserWindow.getFocusedWindow().minimize();
});

ipcMain.on('maximize-window', function() {
  const win = BrowserWindow.getFocusedWindow();
  if (win.isMaximized()) {
    win.unmaximize();
  } else {
    win.maximize();
  }
});

ipcMain.on('close-window', function() {
  BrowserWindow.getFocusedWindow().close();
});

app.on("window-all-closed", function() {
  app.quit();
});