const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const path = require('path');
const moment = require('moment');
const db = require('../db.js');
const { requireLogin } = require('../routes/auth.js');

router.get('/print',requireLogin, async (req, res) => {
    let connection;
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan');

        const logoId = workbook.addImage({
            filename: path.join(__dirname, '../public/img/logo.png'),
            extension: 'png',
        });

        worksheet.addImage(logoId, {
            tl: { col: 1, row: 1 },
            ext: { width: 100, height: 50 }
        });

        worksheet.mergeCells('A1:H1');
        worksheet.mergeCells('A2:H2');
        worksheet.mergeCells('A3:H3');

        const h1 = {
            font: { bold: true, size: 14, name: 'Times New Roman', },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        const h2 = {
            font: { bold: false, size: 14, name: 'Times New Roman', },
        };

        worksheet.getCell('A2').value = 'PT TASPEN (PERSERO) CABANG BOGOR';
        worksheet.getCell('A3').value = `PERIODE: ${moment().format('DD MMMM YYYY')}`;
        worksheet.getCell('A6').value = '';

        ['A2'].forEach(cell => {
            worksheet.getCell(cell).font = h1.font;
            worksheet.getCell(cell).alignment = h1.alignment;
        });
        ['A3'].forEach(cell => {
            worksheet.getCell(cell).font = h2.font;
            worksheet.getCell(cell).alignment = h1.alignment;
        });

        worksheet.getRow(1).height = 30;
        worksheet.getRow(2).height = 25;
        worksheet.getRow(3).height = 25;
        worksheet.getRow(4).height = 25;

        const tableHeaders = [
            'NO',
            'ID BARANG',
            'NAMA BARANG',
            'KATEGORI',
            'LOKASI',
            'HARGA',
            'PEMILIK'
        ];

        const columnWidths = [5, 20, 65, 20, 20, 25, 25];
        columnWidths.forEach((width, i) => {
            worksheet.getColumn(i + 1).width = width;
        });

        const headerRow = worksheet.getRow(5);
        tableHeaders.forEach((header, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        connection = await db.getConnection();
        const [rows] = await connection.query(`
            SELECT 
                b.id_barang,
                b.nama_barang,
                b.kategori,
                b.lokasi_barang,
                b.harga_barang,
                b.status_barang,
                b.waktu_masuk,
                k.id_karyawan,
                kar.nama_karyawan as penanggung_jawab
            FROM Barang b
            LEFT JOIN Kepemilikan k ON b.id_barang = k.id_barang AND status_kepemilikan = 'aktif'
            LEFT JOIN Karyawan kar ON k.id_karyawan = kar.id_karyawan
            WHERE b.status_barang = 'tersedia'
            ORDER BY b.waktu_masuk ASC
        `);

        let rowNumber = 6;
        rows.forEach((row, index) => {
            const dataRow = worksheet.getRow(rowNumber);
        
            dataRow.getCell(1).value = index + 1;
            dataRow.getCell(2).value = row.id_barang;
            dataRow.getCell(3).value = row.nama_barang;
            dataRow.getCell(4).value = row.kategori;
            dataRow.getCell(5).value = row.lokasi_barang;
            dataRow.getCell(6).value = row.harga_barang;
            dataRow.getCell(7).value = row.penanggung_jawab || '-';
        
            for (let i = 1; i <= 7; i++) {
                const cell = dataRow.getCell(i);
        
                cell.font = { name: 'Times New Roman', size: 12 };
        
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
        
                if (i === 1) {
                    cell.alignment = { horizontal: 'center' };
                } else if (i === 6) {
                    cell.alignment = { horizontal: 'right' };
                    cell.numFmt = '#,##0.00';
                } else {
                    cell.alignment = { horizontal: 'left' };
                }
            }
        
            rowNumber++;
        });
        
        const footerRow = rowNumber + 2;

        const h3 = {
            font: { bold: true, size: 12, name: 'Times New Roman' },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };

        [`A${footerRow}`,`F${footerRow}`, `F${footerRow + 1}`, `F${footerRow + 4}`, `F${footerRow + 5}`].forEach(cell => {
            worksheet.getCell(cell).font = h3.font;
            worksheet.getCell(cell).alignment = h3.alignment;
        });

        worksheet.mergeCells(`F${footerRow}:F${footerRow}`);

        worksheet.getCell(`F${footerRow}`).value = 'Bogor, ' + moment().format('DD MMMM YYYY');

        worksheet.getCell(`F${footerRow + 1}`).value = 'BRANCH MANAGER KC BOGOR';
        worksheet.getCell(`F${footerRow + 4}`).value = 'ARDI';
        worksheet.getCell(`F${footerRow + 5}`).value = 'NIK. 2029';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Mitra_Binaan.xlsx');

        await workbook.xlsx.write(res);

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.get('/printKaryawan',requireLogin, async (req, res) => {
    let connection;
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan');

        const logoId = workbook.addImage({
            filename: path.join(__dirname, '../public/img/logo.png'),
            extension: 'png',
        });

        worksheet.addImage(logoId, {
            tl: { col: 1, row: 1 },
            ext: { width: 100, height: 50 }
        });

        worksheet.mergeCells('A1:E1');
        worksheet.mergeCells('A2:E2');
        worksheet.mergeCells('A3:E3');

        const h1 = {
            font: { bold: true, size: 14, name: 'Times New Roman', },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        const h2 = {
            font: { bold: false, size: 14, name: 'Times New Roman', },
        };

        worksheet.getCell('A2').value = 'PT TASPEN (PERSERO) CABANG BOGOR';
        worksheet.getCell('A3').value = `PERIODE: ${moment().format('DD MMMM YYYY')}`;
        worksheet.getCell('A6').value = '';

        ['A2'].forEach(cell => {
            worksheet.getCell(cell).font = h1.font;
            worksheet.getCell(cell).alignment = h1.alignment;
        });
        ['A3'].forEach(cell => {
            worksheet.getCell(cell).font = h2.font;
            worksheet.getCell(cell).alignment = h1.alignment;
        });

        worksheet.getRow(1).height = 30;
        worksheet.getRow(2).height = 25;
        worksheet.getRow(3).height = 25;
        worksheet.getRow(4).height = 25;

        const tableHeaders = [
            'NO',
            'NIK',
            'NAMA',
            'JENIS KELAMIN',
            'JABATAN',
        ];

        const columnWidths = [5, 15, 35, 25, 65,];
        columnWidths.forEach((width, i) => {
            worksheet.getColumn(i + 1).width = width;
        });

        const headerRow = worksheet.getRow(5);
        tableHeaders.forEach((header, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        connection = await db.getConnection();
        const [rows] = await connection.query(`
            SELECT * FROM KARYAWAN ORDER BY id_karyawan ASC
        `);

        let rowNumber = 6;
        rows.forEach((row, index) => {
            const dataRow = worksheet.getRow(rowNumber);
        
            dataRow.getCell(1).value = index + 1;
            dataRow.getCell(2).value = row.id_karyawan;
            dataRow.getCell(3).value = row.nama_karyawan;
            dataRow.getCell(4).value = row.jenis_kelamin;
            dataRow.getCell(5).value = row.jabatan;
        
            for (let i = 1; i <= 5; i++) {
                const cell = dataRow.getCell(i);
        
                cell.font = { name: 'Times New Roman', size: 12 };
        
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
        
                if (i === 1) {
                    cell.alignment = { horizontal: 'center' };
                } else {
                    cell.alignment = { horizontal: 'left' };
                }
            }
        
            rowNumber++;
        });
        
        const footerRow = rowNumber + 2;

        const h3 = {
            font: { bold: true, size: 12, name: 'Times New Roman' },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };

        [`A${footerRow}`,`E${footerRow}`, `E${footerRow + 1}`, `E${footerRow + 4}`, `E${footerRow + 5}`].forEach(cell => {
            worksheet.getCell(cell).font = h3.font;
            worksheet.getCell(cell).alignment = h3.alignment;
        });

        worksheet.mergeCells(`E${footerRow}:E${footerRow}`);

        worksheet.getCell(`E${footerRow}`).value = 'Bogor, ' + moment().format('DD MMMM YYYY');

        worksheet.getCell(`E${footerRow + 1}`).value = 'BRANCH MANAGER KC BOGOR';
        worksheet.getCell(`E${footerRow + 4}`).value = 'ARDI';
        worksheet.getCell(`E${footerRow + 5}`).value = 'NIK. 2029';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Mitra_Binaan.xlsx');

        await workbook.xlsx.write(res);

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

router.get('/printPenjualan',requireLogin, async (req, res) => {
    let connection;
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan');

        const logoId = workbook.addImage({
            filename: path.join(__dirname, '../public/img/logo.png'),
            extension: 'png',
        });

        worksheet.addImage(logoId, {
            tl: { col: 1, row: 1 },
            ext: { width: 100, height: 50 }
        });

        worksheet.mergeCells('A1:H1');
        worksheet.mergeCells('A2:H2');
        worksheet.mergeCells('A3:H3');

        const h1 = {
            font: { bold: true, size: 14, name: 'Times New Roman', },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };
        const h2 = {
            font: { bold: false, size: 14, name: 'Times New Roman', },
        };

        worksheet.getCell('A2').value = 'PT TASPEN (PERSERO) CABANG BOGOR';
        worksheet.getCell('A3').value = `PERIODE: ${moment().format('DD MMMM YYYY')}`;
        worksheet.getCell('A6').value = '';

        ['A2'].forEach(cell => {
            worksheet.getCell(cell).font = h1.font;
            worksheet.getCell(cell).alignment = h1.alignment;
        });
        ['A3'].forEach(cell => {
            worksheet.getCell(cell).font = h2.font;
            worksheet.getCell(cell).alignment = h1.alignment;
        });

        worksheet.getRow(1).height = 30;
        worksheet.getRow(2).height = 25;
        worksheet.getRow(3).height = 25;
        worksheet.getRow(4).height = 25;

        const tableHeaders = [
            'NO',
            'ID BARANG',
            'NAMA BARANG',
            'KATEGORI',
            'HARGA JUAL',
            'STATUS PENJUALAN',
            'TANGGAL PENJUALAN',
        ];

        const columnWidths = [5, 20, 65, 20, 25, 25, 50];
        columnWidths.forEach((width, i) => {
            worksheet.getColumn(i + 1).width = width;
        });

        const headerRow = worksheet.getRow(5);
        tableHeaders.forEach((header, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = header;
            cell.font = { bold: true };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            cell.border = {
                top: { style: 'thin' },
                left: { style: 'thin' },
                bottom: { style: 'thin' },
                right: { style: 'thin' }
            };
        });

        connection = await db.getConnection();
        const [rows] = await connection.query(`
            SELECT * FROM penjualan ORDER BY tanggal_keluar ASC
        `);

        let rowNumber = 6;
        rows.forEach((row, index) => {
            const dataRow = worksheet.getRow(rowNumber);
        
            dataRow.getCell(1).value = index + 1;
            dataRow.getCell(2).value = row.id_barang;
            dataRow.getCell(3).value = row.nama_barang;
            dataRow.getCell(4).value = row.kategori;
            dataRow.getCell(5).value = row.harga_jual;
            dataRow.getCell(6).value = row.status_penjualan;
            dataRow.getCell(7).value = row.tanggal_keluar;
        
            for (let i = 1; i <= 7; i++) {
                const cell = dataRow.getCell(i);
        
                cell.font = { name: 'Times New Roman', size: 12 };
        
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
        
                if (i === 1) {
                    cell.alignment = { horizontal: 'center' };
                } else if (i === 5) {
                    cell.alignment = { horizontal: 'right' };
                    cell.numFmt = '#,##0.00';
                }else {
                    cell.alignment = { horizontal: 'left' };
                }
            }
        
            rowNumber++;
        });
        
        const footerRow = rowNumber + 2;

        const h3 = {
            font: { bold: true, size: 12, name: 'Times New Roman' },
            alignment: { horizontal: 'center', vertical: 'middle' }
        };

        [`A${footerRow}`,`F${footerRow}`, `F${footerRow + 1}`, `F${footerRow + 4}`, `F${footerRow + 5}`].forEach(cell => {
            worksheet.getCell(cell).font = h3.font;
            worksheet.getCell(cell).alignment = h3.alignment;
        });

        worksheet.mergeCells(`F${footerRow}:F${footerRow}`);

        worksheet.getCell(`F${footerRow}`).value = 'Bogor, ' + moment().format('DD MMMM YYYY');

        worksheet.getCell(`F${footerRow + 1}`).value = 'BRANCH MANAGER KC BOGOR';
        worksheet.getCell(`F${footerRow + 4}`).value = 'ARDI';
        worksheet.getCell(`F${footerRow + 5}`).value = 'NIK. 2029';

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=Laporan_Mitra_Binaan.xlsx');

        await workbook.xlsx.write(res);

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel file' });
    } finally {
        if (connection) {
            connection.release();
        }
    }
});

module.exports = router;