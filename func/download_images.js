const fs = require('fs');
const https = require('https');
const path = require('path');

const baseUrl = 'https://arabwuwa.com';
const jsonPath = path.join(__dirname, 'weapons_local.json');

// Hàm tải xuống một ảnh
const downloadImage = (url, filepath) => {
    return new Promise((resolve, reject) => {
        // Tạo thư mục nếu chưa tồn tại
        const dir = path.dirname(filepath);
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir, { recursive: true });
        }
        
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            if (response.statusCode === 200) {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve(filepath);
                });
            } else {
                reject(new Error(`Thất bại khi tải ${url}: HTTP Status ${response.statusCode}`));
            }
        }).on('error', (err) => {
            fs.unlink(filepath, () => {}); // Xóa file lỗi
            reject(err);
        });
    });
};

// Hàm đọc JSON và tải tất cả ảnh
const downloadWeaponsImages = async () => {
    try {
        console.log(`Đang đọc file: ${jsonPath}...`);
        const data = fs.readFileSync(jsonPath, 'utf8');
        const weapons = JSON.parse(data);

        for (const weapon of weapons) {
            // Tải image
            if (weapon.image) {
                const imageUrl = `${baseUrl}${weapon.image}`;
                // Đổi đường dẫn lưu sang public/images/weapon/...
                const relativePath = weapon.image.replace(/^\/?images\/weapons?\//, '');
                const localPath = path.join(__dirname, 'public', 'images', 'weapon', relativePath); 
                
                console.log(`Đang tải: ${imageUrl}`);
                try {
                    await downloadImage(imageUrl, localPath);
                } catch (err) {
                    console.error(err.message);
                }
            }

            // Tải imagebig
            if (weapon.imagebig) {
                const imageBigUrl = `${baseUrl}${weapon.imagebig}`;
                const relativePath = weapon.imagebig.replace(/^\/?images\/weapons?\//, '');
                const localPathBig = path.join(__dirname, 'public', 'images', 'weapon', relativePath);
                
                console.log(`Đang tải: ${imageBigUrl}`);
                try {
                    await downloadImage(imageBigUrl, localPathBig);
                } catch (err) {
                    console.error(err.message);
                }
            }
        }
        console.log('✅ Đã tải xong tất cả ảnh!');
    } catch (error) {
        console.error('Lỗi khi đọc file JSON:', error);
    }
};

// Thực thi hàm
downloadWeaponsImages();
