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
                    body: JSON.stringify({ obsToken: token })
                });

                if (res.ok) {
                    showToast('Lưu mã OBS Security Token thành công!', 'success');
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
    window.showAppsScriptGuide = function (e) {
        if (e) e.preventDefault();
        const code = `function doPost(e) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var data    = JSON.parse(e.postData.contents);
  var tabName = data.tabName || "Match History";
  var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);

  if (sheet.getLastRow() === 0) {
    buildHeader(sheet);
  }

  var players = data.players || [];
  for (var p = 0; p < players.length; p++) {
    var player   = players[p];
    var startRow = sheet.getLastRow() + 1;

    for (var r = 0; r < player.rounds.length; r++) {
      var rd = player.rounds[r];
      sheet.appendRow([
        player.name,
        rd.roundNum,
        rd.resonators[0] || "",
        rd.resonators[1] || "",
        rd.resonators[2] || "",
        rd.baseScore       || 0,
        rd.weaponDeduction || "",
        rd.rcDeductions[0] || "",
        rd.rcDeductions[1] || "",
        rd.rcDeductions[2] || "",
        rd.rcDeductions[3] || "",
        rd.rcDeductions[4] || "",
        rd.rcDeductions[5] || "",
        rd.extraDeduction  || "",
        rd.squadTotal      || 0,
        player.totalScore  || 0
      ]);
    }

    var endRow   = sheet.getLastRow();
    var numRows  = endRow - startRow + 1;

    // Merge cột A (Player name)
    sheet.getRange(startRow, 1, numRows, 1)
      .merge()
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center")
      .setFontWeight("bold");

    // Merge cột P (Điểm tổng cuối)
    sheet.getRange(startRow, 16, numRows, 1)
      .merge()
      .setVerticalAlignment("middle")
      .setHorizontalAlignment("center")
      .setFontWeight("bold")
      .setFontSize(13);

    // Căn giữa các cột còn lại
    sheet.getRange(startRow, 2, numRows, 1).setHorizontalAlignment("center");  // Round
    sheet.getRange(startRow, 3, numRows, 3).setHorizontalAlignment("center");  // Resonators
    sheet.getRange(startRow, 7, numRows, 8).setHorizontalAlignment("center");  // Vũ khí + RC1-6
    sheet.getRange(startRow, 14, numRows, 1).setHorizontalAlignment("center"); // Mua lượt

    // Căn phải điểm số
    sheet.getRange(startRow, 6, numRows, 1).setHorizontalAlignment("right");   // Điểm gốc
    sheet.getRange(startRow, 15, numRows, 1).setHorizontalAlignment("right");  // Tổng đội hình

    // Border nội bộ mỏng + viền ngoài dày
    sheet.getRange(startRow, 1, numRows, 16)
      .setBorder(true, true, true, true, true, true, "#94A3B8", SpreadsheetApp.BorderStyle.SOLID);
    sheet.getRange(startRow, 1, numRows, 16)
      .setBorder(true, true, true, true, null, null, "#1E3A5F", SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildHeader(sheet) {
  var BLUE  = "#4472C4";
  var WHITE = "#FFFFFF";

  mergeStyle(sheet, 1,1,  3,1,  "Player",                BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,2,  3,2,  "Team/Round",            BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,3,  3,5,  "Resonator sử dụng",     BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,6,  3,6,  "Điểm gốc",              BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,7,  1,13, "Điểm trừ",              BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 2,7,  3,7,  "Vũ khí",                BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 2,8,  2,13, "RC",                    BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,14, 3,14, "Điểm mua\\nlượt đánh",   BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,15, 3,15, "Điểm tổng\\ntừng đội hình", BLUE, WHITE, true, "CENTER");
  mergeStyle(sheet, 1,16, 3,16, "Điểm tổng\\ncuối cùng",  BLUE, WHITE, true, "CENTER");

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
  if (r1 !== r2 || c1 !== c2) {
    try { range.merge(); } catch(e) {}
  }
  range.setValue(value)
    .setBackground(bg).setFontColor(fg)
    .setFontWeight(bold ? "bold" : "normal")
    .setHorizontalAlignment(align)
    .setVerticalAlignment("middle")
    .setWrap(true);
}`;

        const popup = window.open("", "AppsScriptGuide", "width=850,height=650,scrollbars=yes");
        popup.document.write(`
            <html>
            <head>
                <title>Apps Script Guide - KDSTREAM</title>
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
