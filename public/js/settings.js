(() => {
    // Toggle OBS Token visibility
    const tokenInput = document.getElementById('sett-token-input');
    const toggleTokenBtn = document.getElementById('sett-btn-toggle-token');
    const toggleTokenIcon = document.getElementById('sett-toggle-token-icon');

    if (toggleTokenBtn && tokenInput && toggleTokenIcon) {
        toggleTokenBtn.addEventListener('click', () => {
            if (tokenInput.style.webkitTextSecurity === 'none') {
                tokenInput.style.webkitTextSecurity = 'disc';
                toggleTokenIcon.className = 'fas fa-eye-slash';
            } else {
                tokenInput.style.webkitTextSecurity = 'none';
                toggleTokenIcon.className = 'fas fa-eye';
            }
        });
    }

    // Toggle Google Apps Script Web App URL visibility
    const appsScriptInput = document.getElementById('sett-apps-script-url-input');
    const toggleAppsScriptBtn = document.getElementById('sett-btn-toggle-apps-script');
    const toggleAppsScriptIcon = document.getElementById('sett-toggle-apps-script-icon');

    if (toggleAppsScriptBtn && appsScriptInput && toggleAppsScriptIcon) {
        toggleAppsScriptBtn.addEventListener('click', () => {
            if (appsScriptInput.style.webkitTextSecurity === 'none') {
                appsScriptInput.style.webkitTextSecurity = 'disc';
                toggleAppsScriptIcon.className = 'fas fa-eye-slash';
            } else {
                appsScriptInput.style.webkitTextSecurity = 'none';
                toggleAppsScriptIcon.className = 'fas fa-eye';
            }
        });
    }

    // Toggle Multi-Device Sync switch
    const syncSwitch = document.getElementById('sett-is-sync-switch');
    if (syncSwitch) {
        syncSwitch.addEventListener('click', () => {
            syncSwitch.classList.toggle('on');
        });
    }

    // Random token generator
    const generateBtn = document.getElementById('sett-btn-generate');
    if (generateBtn) {
        generateBtn.addEventListener('click', () => {
            const rnd = Math.random().toString(36).substring(2, 10);
            const input = document.getElementById('sett-token-input');
            if (input) {
                input.value = 'kdstream_' + rnd;
            }
            showToast('Đã sinh mã token ngẫu nhiên mới!', 'success');
        });
    }

    // Load settings from backend
    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();

            if (data) {
                const tokenInp = document.getElementById('sett-token-input');
                const sheetInp = document.getElementById('sett-apps-script-url-input');
                if (data.obsToken && tokenInp) {
                    tokenInp.value = data.obsToken;
                }
                if (data.googleAppsScriptUrl && sheetInp) {
                    sheetInp.value = data.googleAppsScriptUrl;
                }
                
                // Hiển thị trạng thái isSync
                const syncSwitch = document.getElementById('sett-is-sync-switch');
                if (syncSwitch) {
                    syncSwitch.classList.toggle('on', !!data.isSync);
                }
            }
        } catch (e) {
            showToast('Lỗi tải cấu hình từ máy chủ: ' + e.message, 'error');
        }
    }

    // Save OBS Security Token to backend
    const saveSettingsBtn = document.getElementById('sett-btn-save-settings');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', async () => {
            const tokenInp = document.getElementById('sett-token-input');
            const token = tokenInp ? tokenInp.value.trim() : '';
            const syncSwitch = document.getElementById('sett-is-sync-switch');
            const isSync = syncSwitch ? syncSwitch.classList.contains('on') : false;

            if (!token) {
                showToast('OBS Token cannot be empty!', 'error');
                return;
            }

            const btn = document.getElementById('sett-btn-save-settings');
            btn.disabled = true;
            const oldHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ obsToken: token, isSync: isSync })
                });

                if (res.ok) {
                    showToast('Lưu mã OBS Security Token & Chế độ đồng bộ thành công!', 'success');
                } else {
                    showToast('Lỗi lưu OBS Token!', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối máy chủ: ' + e.message, 'error');
            }

            btn.disabled = false;
            btn.innerHTML = oldHtml;
        });
    }

    // Save Google Sheets Match Sync Web App URL to backend
    const saveSheetsBtn = document.getElementById('sett-btn-save-sheets');
    if (saveSheetsBtn) {
        saveSheetsBtn.addEventListener('click', async () => {
            const sheetInp = document.getElementById('sett-apps-script-url-input');
            const appsScriptUrl = sheetInp ? sheetInp.value.trim() : '';

            const btn = document.getElementById('sett-btn-save-sheets');
            btn.disabled = true;
            const oldHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

            try {
                const res = await fetch('/api/settings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ googleAppsScriptUrl: appsScriptUrl })
                });

                if (res.ok) {
                    showToast(' Lưu cấu hình Google Sheets Match Sync thành công!', 'success');
                } else {
                    showToast('Lỗi lưu cấu hình Google Sheets!', 'error');
                }
            } catch (e) {
                showToast('Lỗi kết nối máy chủ: ' + e.message, 'error');
            }

            btn.disabled = false;
            btn.innerHTML = oldHtml;
        });
    }

    // Show Google Apps Script Guide
    window.showAppsScriptGuide = async function (e) {
        if (e) e.preventDefault();

        let characterList = [];
        try {
            const res = await fetch('/api/characters');
            const data = await res.json();
            if (Array.isArray(data)) {
                characterList = data.map(c => ({
                    name: c.name,
                    element: c.element
                })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'vi'));
            }
        } catch (err) {
            console.error('Error fetching character list:', err);
            // Fallback character list in case fetch fails
            characterList = [
                {name:"Aalto",element:4},{name:"Aemeath",element:2},{name:"Augusta",element:3},
                {name:"Baizhi",element:1},{name:"Brant",element:2},{name:"Buling",element:3},
                {name:"Calcharo",element:3},{name:"Camellya",element:6},{name:"Cantarella",element:6},
                {name:"Carlotta",element:1},{name:"Cartethyia",element:4},{name:"Changli",element:2},
                {name:"Chisa",element:6},{name:"Chixia",element:2},{name:"Ciaccona",element:4},
                {name:"Danjin",element:6},{name:"Denia",element:2},{name:"Encore",element:2},
                {name:"Galbrena",element:2},{name:"Hiyuki",element:1},{name:"Iuno",element:4},
                {name:"Jianxin",element:4},{name:"Jinhsi",element:5},{name:"Jiyan",element:4},
                {name:"Lingyang",element:1},{name:"Lumi",element:3},{name:"Lupa",element:2},
                {name:"Luuk Herssen",element:5},{name:"Lynae",element:5},{name:"Mornye",element:2},
                {name:"Mortefi",element:2},{name:"Phoebe",element:5},{name:"Phrolova",element:6},
                {name:"Qiuyuan",element:4},{name:"Roccia",element:6},{name:"Rover",element:0},
                {name:"Sanhua",element:1},{name:"Shorekeeper",element:5},{name:"Sigrika",element:4},
                {name:"Taoqi",element:6},{name:"Verina",element:5},{name:"Xiangli Yao",element:3},
                {name:"Yangyang",element:4},{name:"Yinlin",element:3},{name:"Youhu",element:1},
                {name:"Yuanwu",element:3},{name:"Zani",element:5},{name:"Zhezhi",element:1}
            ];
        }

        // Format CHARACTER_LIST nicely as string: 3 elements per line
        const charLines = [];
        for (let i = 0; i < characterList.length; i += 3) {
            const chunk = characterList.slice(i, i + 3);
            const line = chunk.map(c => `{name:${JSON.stringify(c.name)},element:${c.element}}`).join(',');
            charLines.push('  ' + line);
        }
        const charListStr = charLines.join(',\n');

        const code = `// ============================================================
// MAPPING ELEMENT
// ============================================================
var ELEMENT_NAMES = {
  0:"Unknown",1:"Glacio",2:"Fusion",3:"Electro",4:"Aero",5:"Spectro",6:"Havoc"
};

// Danh sách char dự phòng (Fallback) - dùng nếu không nhận được dữ liệu từ payload
var CHARACTER_LIST = [
${charListStr}
];

// ============================================================
// Tạo/update sheet _CharList (ẩn) — source cho dropdown
// ============================================================
function ensureCharListSheet(ss, charList) {
  var charSheet = ss.getSheetByName("_CharList");
  if (!charSheet) {
    charSheet = ss.insertSheet("_CharList");
    charSheet.hideSheet();
  }
  charSheet.clearContents();

  // Header
  charSheet.getRange(1, 1).setValue("Name");
  charSheet.getRange(1, 2).setValue("Element");

  // Data
  for (var i = 0; i < charList.length; i++) {
    var c = charList[i];
    charSheet.getRange(i + 2, 1).setValue(c.name);
    charSheet.getRange(i + 2, 2).setValue(ELEMENT_NAMES[c.element] || "");
  }

  return charSheet;
}

// ============================================================
// Tạo Data Validation rule trỏ vào _CharList!A2:A{n}
// ============================================================
function makeCharValidation(ss, charList) {
  var n = charList.length + 1; // +1 vì row 1 là header
  var sourceRange = ss.getSheetByName("_CharList").getRange("A2:A" + n);
  return SpreadsheetApp.newDataValidation()
    .requireValueInRange(sourceRange, true)  // true = show dropdown
    .setAllowInvalid(false)
    .build();
}

// ============================================================
// doPost
// ============================================================
function doPost(e) {
  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var data    = JSON.parse(e.postData.contents);
  var tabName = data.tabName || "Match History";
  var sheet   = ss.getSheetByName(tabName) || ss.insertSheet(tabName);

  // Nhận danh sách nhân vật động từ server payload (đảm bảo luôn đúng mới nhất)
  // Nếu không có, dùng CHARACTER_LIST backup có sẵn ở trên
  var charList = data.characters || CHARACTER_LIST;

  // Đảm bảo _CharList tồn tại trước
  ensureCharListSheet(ss, charList);
  var charRule = makeCharValidation(ss, charList);

  if (sheet.getLastRow() === 0) {
    buildHeader(sheet);
  }

  var players = data.players || [];

  for (var p = 0; p < players.length; p++) {
    var player   = players[p];
    var startRow = sheet.getLastRow() + 1;

    for (var r = 0; r < player.rounds.length; r++) {
      var rd    = player.rounds[r];
      var rcDed = rd.rcDeductions || [];

      sheet.appendRow([
        player.name,             // A
        rd.roundNum,             // B
        rd.resonators[0] || "", // C ← sẽ gắn dropdown
        rd.resonators[1] || "", // D ← sẽ gắn dropdown
        rd.resonators[2] || "", // E ← sẽ gắn dropdown
        rd.baseScore      || 0, // F
        rd.weaponDeduction|| "", // G
        rcDed[0] || "",          // H RC1
        rcDed[1] || "",          // I RC2
        rcDed[2] || "",          // J RC3
        rcDed[3] || "",          // K RC4
        rcDed[4] || "",          // L RC5
        rcDed[5] || "",          // M RC6
        rd.extraDeduction || "", // N
        rd.squadTotal     || 0, // O
        player.totalScore || 0  // P
      ]);

      var newRow = sheet.getLastRow();

      // ✅ Gắn Data Validation dropdown vào 3 ô char của dòng vừa append
      sheet.getRange(newRow, 3).setDataValidation(charRule); // C
      sheet.getRange(newRow, 4).setDataValidation(charRule); // D
      sheet.getRange(newRow, 5).setDataValidation(charRule); // E
    }

    var endRow  = sheet.getLastRow();
    var numRows = endRow - startRow + 1;

    // Merge + style (giữ nguyên như cũ, 16 cột A→P)
    sheet.getRange(startRow, 1, numRows, 1)
      .merge().setVerticalAlignment("middle")
      .setHorizontalAlignment("center").setFontWeight("bold");

    sheet.getRange(startRow, 16, numRows, 1)
      .merge().setVerticalAlignment("middle")
      .setHorizontalAlignment("center")
      .setFontWeight("bold").setFontSize(13);

    sheet.getRange(startRow, 2,  numRows, 1).setHorizontalAlignment("center");
    sheet.getRange(startRow, 3,  numRows, 3).setHorizontalAlignment("center");
    sheet.getRange(startRow, 7,  numRows, 8).setHorizontalAlignment("center");
    sheet.getRange(startRow, 14, numRows, 1).setHorizontalAlignment("center");
    sheet.getRange(startRow, 6,  numRows, 1).setHorizontalAlignment("right");
    sheet.getRange(startRow, 15, numRows, 1).setHorizontalAlignment("right");

    sheet.getRange(startRow, 1, numRows, 16)
      .setBorder(true,true,true,true,true,true, "#94A3B8", SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(startRow, 1, numRows, 16)
      .setBorder(true,true,true,true,null,null,  "#1E3A5F", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// Hàm chạy tay 1 lần để setup _CharList (không cần thiết
// nếu đã có doPost, nhưng tiện để test)
// ============================================================
function setupCharList() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureCharListSheet(ss, CHARACTER_LIST);
  SpreadsheetApp.getUi().alert("✅ _CharList đã được tạo!");
}

// ============================================================
// buildHeader + mergeStyle (giữ nguyên như cũ)
// ============================================================
function buildHeader(sheet) {
  var BLUE  = "#4472C4";
  var WHITE = "#FFFFFF";

  mergeStyle(sheet, 1,1,  3,1,  "Player",                   BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,2,  3,2,  "Team/Round",               BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,3,  3,5,  "Resonator sử dụng",        BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,6,  3,6,  "Điểm gốc",                 BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,7,  1,13, "Điểm trừ",                 BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 2,7,  3,7,  "Vũ khí",                   BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 2,8,  2,13, "RC",                        BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,14, 3,14, "Điểm mua\\nlượt đánh",      BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,15, 3,15, "Điểm tổng\\ntừng đội hình", BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,16, 3,16, "Điểm tổng\\ncuối cùng",     BLUE, WHITE, true, "CENTER");

  var rcLabels = ["RC1","RC2","RC3","RC4","RC5","RC6"];
  for (var i = 0; i < 6; i++) {
    sheet.getRange(3, 8+i)
      .setValue(rcLabels[i])
      .setBackground(BLUE).setFontColor(WHITE)
      .setFontWeight("bold")
      .setHorizontalAlignment("CENTER")
      .setVerticalAlignment("middle");
  }

  sheet.setColumnWidth(1, 90);
  sheet.setColumnWidth(2, 75);
  sheet.setColumnWidth(3, 110);
  sheet.setColumnWidth(4, 110);
  sheet.setColumnWidth(5, 110);
  sheet.setColumnWidth(6, 80);
  sheet.setColumnWidth(7, 65);
  for (var c = 8; c <= 13; c++) sheet.setColumnWidth(c, 48);
  sheet.setColumnWidth(14, 85);
  sheet.setColumnWidth(15, 100);
  sheet.setColumnWidth(16, 100);

  sheet.setRowHeight(1, 22);
  sheet.setRowHeight(2, 22);
  sheet.setRowHeight(3, 22);
  sheet.setFrozenRows(3);
}

function mergeStyle(sheet, r1,c1, r2,c2, value, bg, fg, bold, align) {
  var range = sheet.getRange(r1, c1, r2-r1+1, c2-c1+1);
  if (r1 !== r2 || c1 !== c2) { try { range.merge(); } catch(e) {} }
  range.setValue(value)
    .setBackground(bg).setFontColor(fg)
    .setFontWeight(bold ? "bold" : "normal")
    .setHorizontalAlignment(align)
    .setVerticalAlignment("middle")
    .setWrap(true);
}
`;

        const popup = window.open("", "AppsScriptGuide", "width=850,height=650,scrollbars=yes");
        popup.document.write(`
            <html>
            <head>
                <title>Apps Script Guide - MATRIX HUB</title>
                <style>
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #0b0d14; color: #e2e8f0; padding: 32px; line-height: 1.6; }
                    pre { background: #0f172a; padding: 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); overflow-x: auto; color: #00f5ff; font-family: 'DM Mono', monospace; font-size: 13px; }
                    h2 { color: #00f5ff; font-family: 'Outfit', sans-serif; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-top: 0; }
                    code { font-family: monospace; background: rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 4px; color: #00f5ff; }
                    .btn-copy { background: linear-gradient(135deg, #00f5ff 0%, #00b8d4 100%); color: #0b0d14; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px; margin-bottom: 15px; transition: 0.2s; }
                    .btn-copy:hover { filter: brightness(1.15); box-shadow: 0 0 12px rgba(0,245,255,0.4); }
                    li { margin-bottom: 12px; }
                    ul { margin-top: 6px; }
                </style>
            </head>
            <body>
                <h2>Hướng Dẫn Đồng Bộ Google Sheets (Kết quả trận đấu)</h2>
                <ol>
                    <li>Mở <b>Google Spreadsheet</b> của bạn.</li>
                    <li>Chọn menu <b>Tiện ích mở rộng (Extensions)</b> > <b>Apps Script</b>.</li>
                    <li>Xóa mọi đoạn mã hiện có và dán đoạn mã bên dưới vào:</li>
                </ol>
                <textarea id="codeBlock" style="display:none;">${code}</textarea>
                <pre>${code}</pre>
                <button class="btn-copy" onclick="navigator.clipboard.writeText(document.getElementById('codeBlock').value); alert('📋 Đã sao chép mã Apps Script thành công!');">Copy Mã Apps Script</button>
                <ol start="4">
                    <li>Nhấn nút <b>Lưu (Save)</b> (biểu tượng đĩa mềm).</li>
                    <li>Click vào nút <b>Triển khai (Deploy)</b> ở góc trên cùng bên phải > Chọn <b>Triển khai mới (New deployment)</b>.</li>
                    <li>Chọn loại triển khai là <b>Ứng dụng web (Web app)</b> bằng cách bấm vào bánh răng cài đặt.</li>
                    <li>Cấu hình triển khai:
                        <ul>
                            <li>Mô tả: Match History Sync</li>
                            <li>Ứng dụng dưới danh nghĩa: <b>Tôi (Me)</b></li>
                            <li>Ai có quyền truy cập: <b>Bất kỳ ai (Anyone)</b> <span style="color:#ff4444;font-weight:bold;">(BẮT BUỘC để server gửi kết quả lên được)</span>.</li>
                        </ul>
                    </li>
                    <li>Nhấn <b>Triển khai (Deploy)</b>, cấp quyền truy cập tài khoản Google của bạn nếu được hỏi.</li>
                    <li>Copy lấy đường dẫn <b>URL ứng dụng web (Web app URL)</b> hiển thị ở cuối bảng.</li>
                    <li>Dán đường dẫn URL vừa copy vào ô <b>Google Apps Script Web App URL</b> trên trang Cài đặt (Settings) của MATRIX HUB và nhấn Lưu!</li>
                </ol>
            </body>
            </html>
        `);
        popup.document.close();
    };

    // Load settings immediately
    window.refreshSettings = loadSettings;
    loadSettings();
})();
