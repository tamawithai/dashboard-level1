// --- BAGIAN 1: KAMUS PEMETAAN (TANPA URL DEFAULT) ---
const METRIC_MAP = {
    "1. Ketepatan waktu dan kehadiran": "pengajar",
    "2. Sistematika penyampaian materi pelatihan": "pengajar",
    "3. Pemahaman substansi materi pelatihan": "pengajar",
    "4. Kemampuan penyajian materi dan pemanfaatan media pelatihan": "pengajar",
    "5. Cara mengelola diskusi dan pertanyaan dari peserta": "pengajar",
    "1. Kesesuaian tujuan dan topik pelatihan": "materi",
    "2. Tingkat kemudahan materi untuk dipahami": "materi",
    "3. Manfaat/kegunaan materi (penerapan)": "materi",
    "4. Alokasi waktu sesuai dengan substansi pelatihan": "materi",
    "1. Kemudahan mendapatkan layanan seperti informasi dan kebutuhan pendukung pelatihan": "penyelenggara",
    "2. Kesigapan penyelenggara dalam melayani peserta": "penyelenggara",
    "3. Kemudahan dalam memperoleh materi pelatihan": "penyelenggara",
    "1. Kemudahan dalam mengakses media pelatihan": "sarana",
    "2. Kualitas audio visual pendukung pelatihan": "sarana",
    "3. Kualitas media pelatihan (zoom meeting dan jaringan internet)": "sarana",
    "4. Pengoperasian sistem penunjang pelatihan stabil dan lancar": "sarana"
};

document.addEventListener('DOMContentLoaded', function () {
    // --- BAGIAN 2: PENGATURAN AWAL ---
    let chartInstance = null;
    let rawCsvText = null;
    Chart.register(ChartDataLabels);
    setupInteractiveElements();
    
    const activeUrl = localStorage.getItem('googleSheetUrl');
    
    if (activeUrl) {
        loadDashboardData(activeUrl);
    } else {
        renderEmptyState();
    }

    // --- BAGIAN 3: FUNGSI MEMUAT DATA ---
    function loadDashboardData(url) {
        showLoadingState(true);
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;

        fetch(proxyUrl)
            .then(response => {
                if (!response.ok) throw new Error('URL tidak valid atau Gagal mengambil data.');
                return response.text();
            })
            .then(csvText => {
                rawCsvText = csvText;
                showLoadingState(false);
                const dataEvaluasi = parseRawCsvToData(csvText);
                if(chartInstance) chartInstance.destroy();
                initializeDashboard(dataEvaluasi);
            })
            .catch(error => {
                showLoadingState(false);
                document.querySelector('.subtitle').textContent = 'Error: ' + error.message;
            });
    }

    // --- BAGIAN 4: PARSER DATA ---
    function parseRawCsvToData(csvText) {
        const lines = csvText.trim().split('\n').map(line => line.trim());
        if (lines.length < 2) return null;

        const headersFromSheet = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        
        const dataRows = lines.slice(1).filter(row => {
            return row.trim() !== '' && row.split(',')[0].trim() !== '';
        });

        const processedData = {
            pengajar: { label: 'Pengajar', skor: [], subMetrik: [] },
            materi: { label: 'Materi/Kurikulum', skor: [], subMetrik: [] },
            penyelenggara: { label: 'Penyelenggara', skor: [], subMetrik: [] },
            sarana: { label: 'Sarana & Prasarana', skor: [], subMetrik: [] },
        };
        
        headersFromSheet.forEach((header, columnIndex) => {
            for (const knownQuestion in METRIC_MAP) {
                if (header === knownQuestion) {
                    const categoryKey = METRIC_MAP[knownQuestion];
                    processedData[categoryKey].subMetrik.push(knownQuestion);
                    
                    const scoresForThisColumn = dataRows.map(row => parseFloat(row.split(',')[columnIndex]) || 0);
                    const averageScore = (scoresForThisColumn.reduce((a, b) => a + b, 0) / scoresForThisColumn.length || 0);
                    processedData[categoryKey].skor.push(averageScore);
                    break;
                }
            }
        });
        
        return {
            jumlahResponden: dataRows.length,
            detailSkor: processedData
        };
    }

    // --- BAGIAN 5: INISIALISASI DASHBOARD ---
    function initializeDashboard(dataEvaluasi) {
        if (!dataEvaluasi) {
            renderEmptyState();
            return;
        }
        
        const hitungRataRata = (arr) => {
            if (!arr || arr.length === 0) return 0;
            const total = arr.reduce((a, b) => a + parseFloat(b), 0);
            return total / arr.length;
        };

        const skorRataRataNumerik = Object.values(dataEvaluasi.detailSkor).map(kat => hitungRataRata(kat.skor));
        
        const skorAkhir = hitungRataRata(skorRataRataNumerik);
        const kategoriSkor = getKategoriSkor(skorAkhir);
        
        document.getElementById('skor-akhir').textContent = skorAkhir > 0 ? skorAkhir.toFixed(2) : 'N/A';
        const kategoriEl = document.getElementById('skor-kategori');
        kategoriEl.textContent = kategoriSkor.text;
        kategoriEl.className = kategoriSkor.className;
        
        document.getElementById('jumlah-responden').textContent = dataEvaluasi.jumlahResponden;
        
        document.getElementById('detail-title').innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            Rincian Aspek`;
        document.getElementById('detail-content').innerHTML = `<p style="text-align: center; color: var(--warna-teks-sekunder);">Klik pada salah satu batang grafik untuk menampilkan detail.</p>`;

        const chartCanvas = document.getElementById('chart-aspek-utama');
        if (!chartCanvas) return;
        
        const chartContainer = document.querySelector('.chart-card');
        if (chartContainer) {
            chartContainer.innerHTML = `
                <h2>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8a6 6 0 0 0-6-6H3"/><path d="M14 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>
                    Penilaian Rata-rata per Aspek
                </h2>
                <canvas id="chart-aspek-utama"></canvas>`;
            document.getElementById('chart-aspek-utama').parentElement.style.height = '400px';
        }
        
        const skorBulat = skorRataRataNumerik.map(s => parseFloat(s.toFixed(2)));
        const maxSkor = Math.max(...skorBulat.filter(s => s > 0));
        const minSkor = Math.min(...skorBulat.filter(s => s > 0));

        const colorRed = { bg: 'rgba(239, 68, 68, 0.7)', border: 'rgba(239, 68, 68, 1)' };
        const colorYellow = { bg: 'rgba(234, 179, 8, 0.7)', border: 'rgba(234, 179, 8, 1)' };
        const colorGreen = { bg: 'rgba(34, 197, 94, 0.7)', border: 'rgba(34, 197, 94, 1)' };

        const backgroundColors = skorBulat.map(skor => {
            if (skor <= 0) return colorYellow.bg;
            if (skor >= maxSkor) return colorGreen.bg;
            if (skor <= minSkor) return colorRed.bg;
            return colorYellow.bg;
        });

        const borderColors = skorBulat.map(skor => {
            if (skor <= 0) return colorYellow.border;
            if (skor >= maxSkor) return colorGreen.border;
            if (skor <= minSkor) return colorRed.border;
            return colorYellow.border;
        });

        const isLightModeNow = document.documentElement.classList.contains('light-mode');
        const initialYAxisColor = isLightModeNow ? '#212529' : '#e2e8f0';
        const initialXAxisColor = isLightModeNow ? '#6c757d' : '#a0aec0';

        chartInstance = new Chart(document.getElementById('chart-aspek-utama'), {
            type: 'bar',
            data: {
                labels: Object.values(dataEvaluasi.detailSkor).map(kat => kat.label),
                datasets: [{
                    label: 'Skor Rata-rata',
                    data: skorRataRataNumerik,
                    backgroundColor: backgroundColors,
                    borderColor: borderColors,
                    borderWidth: 1,
                    borderRadius: 5,
                }]
            },
            options: { 
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                scales: {
                    x: { beginAtZero: true, max: 5.0, ticks: { color: initialXAxisColor } },
                    y: { ticks: { color: initialYAxisColor, font: { size: 14 } } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true, callbacks: { label: (context) => `Skor: ${context.parsed.x.toFixed(2)}` } },
                    datalabels: {
                        anchor: 'end',
                        align: 'end',
                        offset: 8,
                        color: initialYAxisColor,
                        font: { weight: 'bold', size: 14, family: 'Poppins' },
                        formatter: (value) => value.toFixed(2)
                    }
                },
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                },
                onClick: (event, elements) => {
                    if (elements.length > 0) {
                        const kategori = Object.keys(dataEvaluasi.detailSkor)[elements[0].index];
                        tampilkanDetail(kategori, dataEvaluasi);
                    }
                }
            }
        });
    }

    // --- BAGIAN 7: FUNGSI-FUNGSI BANTU & INTERAKTIF ---
    function getKategoriSkor(skor) {
        if (skor >= 4.01) {
            return { text: 'Sangat Memuaskan', className: 'kategori-sangat-memuaskan' };
        } else if (skor >= 3.01) {
            return { text: 'Memuaskan', className: 'kategori-memuaskan' };
        } else if (skor >= 2.01) {
            return { text: 'Cukup Memuaskan', className: 'kategori-cukup' };
        } else if (skor > 0) {
            return { text: 'Kurang Memuaskan', className: 'kategori-kurang' };
        }
        return { text: 'Belum Ada Data', className: '' };
    }

    function renderEmptyState() {
        document.querySelector('.subtitle').textContent = 'Silakan atur Sumber Data untuk memulai.';
        document.getElementById('skor-akhir').textContent = '-';
        document.getElementById('jumlah-responden').textContent = '-';
        
        const chartCard = document.querySelector('.chart-card');
        if(chartCard) {
            chartCard.innerHTML = `
                <h2>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M18.7 8a6 6 0 0 0-6-6H3"/><path d="M14 15a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"/></svg>
                    Penilaian Rata-rata per Aspek
                </h2>
                <div style="text-align:center; padding: 50px 20px; color: var(--warna-teks-sekunder);">Data belum dimuat.</div>`;
        }

        document.getElementById('detail-title').innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            Rincian Aspek`;
        document.getElementById('detail-content').innerHTML = `<p style="text-align: center; color: var(--warna-teks-sekunder);">Data belum dimuat.</p>`;
        document.getElementById('skor-kategori').textContent = 'Belum Ada Data';
        document.getElementById('skor-kategori').className = 'skor-akhir-kategori';
    }
    
    function tampilkanDetail(kategori, data) {
         const dataKategori = data.detailSkor[kategori];
        document.getElementById('detail-title').innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
            Rincian Aspek: ${dataKategori.label}`;
        const contentDiv = document.getElementById('detail-content');
        if (dataKategori && dataKategori.subMetrik.length > 0) {
            contentDiv.innerHTML = `<ul>${dataKategori.subMetrik.map((sub, i) => `<li><span>${sub}</span><strong>${dataKategori.skor[i].toFixed(2)}</strong></li>`).join('')}</ul>`;
        } else {
            contentDiv.innerHTML = `<p>Tidak ada data detail untuk ditampilkan pada kategori ini.</p>`;
        }
    }

    function setupInteractiveElements() {
        const menuDashboard = document.getElementById('menu-dashboard');
        const menuLaporan = document.getElementById('menu-laporan');
        const pageDashboard = document.getElementById('page-dashboard');
        const pageLaporan = document.getElementById('page-laporan-detail');

        menuDashboard.addEventListener('click', (e) => {
            e.preventDefault();
            pageDashboard.classList.remove('hidden');
            pageLaporan.classList.add('hidden');
            menuDashboard.classList.add('active');
            menuLaporan.classList.remove('active');
        });

        menuLaporan.addEventListener('click', (e) => {
            e.preventDefault();
            pageDashboard.classList.add('hidden');
            pageLaporan.classList.remove('hidden');
            menuDashboard.classList.remove('active');
            menuLaporan.classList.add('active');
            if (rawCsvText) {
                renderLaporanTable(rawCsvText);
            }
        });

        document.getElementById('toggle-sidebar-btn').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });
        
        const themeToggleBtn = document.getElementById('theme-toggle');
        themeToggleBtn.addEventListener('click', () => {
            const htmlEl = document.documentElement;
            htmlEl.classList.toggle('light-mode');
            htmlEl.classList.toggle('dark-mode');
            
            const isLightMode = htmlEl.classList.contains('light-mode');
            themeToggleBtn.querySelector('.theme-button-text').textContent = isLightMode ? 'Mode Gelap' : 'Mode Terang';
            
            const lightIconPath = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z";
            const darkIconPath = "M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z";
            document.getElementById('theme-icon').querySelector('path').setAttribute('d', isLightMode ? darkIconPath : lightIconPath);
            
            if (chartInstance) {
                const newYColor = isLightMode ? '#212529' : '#e2e8f0';
                const newXColor = isLightMode ? '#6c757d' : '#a0aec0';
                chartInstance.options.scales.x.ticks.color = newXColor;
                chartInstance.options.scales.y.ticks.color = newYColor;
                
                if (chartInstance.options.plugins.datalabels) {
                   chartInstance.options.plugins.datalabels.color = newYColor;
                }
                
                chartInstance.update();
            }
        });

        const modal = document.getElementById('data-source-modal');
        const urlInput = document.getElementById('url-input');

        document.getElementById('data-source-menu').addEventListener('click', () => {
            urlInput.value = localStorage.getItem('googleSheetUrl') || '';
            showModal();
        });

        document.getElementById('save-url-btn').addEventListener('click', () => {
            const newUrl = urlInput.value.trim();
            if (newUrl) {
                localStorage.setItem('googleSheetUrl', newUrl);
                hideModal();
                window.location.reload();
            }
        });

        document.getElementById('cancel-btn').addEventListener('click', hideModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                hideModal();
            }
        });
    }

    function renderLaporanTable(csvText) {
        const container = document.getElementById('laporan-table-container');
        if (!csvText) {
            container.innerHTML = `<p>Data belum dimuat. Silakan atur Sumber Data terlebih dahulu.</p>`;
            return;
        }

        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
        const rows = lines.slice(1);

        let tableHtml = '<table class="laporan-table"><thead><tr>';
        headers.forEach(header => {
            tableHtml += `<th>${header}</th>`;
        });
        tableHtml += '</tr></thead><tbody>';

        rows.forEach(rowStr => {
            const cells = rowStr.split(',');
            tableHtml += '<tr>';
            cells.forEach(cell => {
                tableHtml += `<td>${cell.replace(/"/g, '').trim()}</td>`;
            });
            tableHtml += '</tr>';
        });

        tableHtml += '</tbody></table>';
        container.innerHTML = tableHtml;
    }

    function showLoadingState(isLoading) {
        const subtitle = document.querySelector('.subtitle');
        if (isLoading) {
            subtitle.textContent = 'Memuat data dari Google Sheets...';
            document.getElementById('skor-akhir').textContent = '...';
            document.getElementById('jumlah-responden').textContent = '...';
            document.getElementById('skor-kategori').textContent = '...';
        } else {
            subtitle.textContent = 'Monitoring Evaluasi Pelatihan Level 1';
        }
    }
    
    function showModal() {
        document.getElementById('data-source-modal').classList.add('visible');
    }

    function hideModal() {
        document.getElementById('data-source-modal').classList.remove('visible');
    }
});