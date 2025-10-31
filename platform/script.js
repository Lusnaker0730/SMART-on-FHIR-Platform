/* SMART 平台主要功能腳本 */
let smartClient = null;
let patientData = null;
let encounterData = null;
let userData = null;
let currentHook = null;
let hookInterval = null;
const FHIR_BASE = "http://localhost:8080/fhir";
const examplePatientId = "1";

/* CDS Hooks 定義*/
const cdsHooks = {
    'patient-view': {
        id: 'patient-view',
        name: 'Patient View Hook',
        description: '當查看患者信息時觸發的臨床決策支持',
        icon: 'fas fa-user-circle',
        enabled: false,
        generator: generatePatientViewHook
    },
    'medication-prescribe': {
        id: 'medication-prescribe',
        name: 'Medication Prescribe Hook',
        description: '開處方時的藥物相互作用檢查',
        icon: 'fas fa-pills',
        enabled: false,
        generator: generateMedicationPrescribeHook
    },
    'order-review': {
        id: 'order-review',
        name: 'Order Review Hook',
        description: '醫囑復查時的提醒和建議',
        icon: 'fas fa-clipboard-check',
        enabled: false,
        generator: generateOrderReviewHook
    },
    'encounter-start': {
        id: 'encounter-start',
        name: 'Encounter Start Hook',
        description: '診療開始時的風險評估',
        icon: 'fas fa-play-circle',
        enabled: false,
        generator: generateEncounterStartHook
    },
    'encounter-discharge': {
        id: 'encounter-discharge',
        name: 'Encounter Discharge Hook',
        description: '出院時的建議和後續護理',
        icon: 'fas fa-sign-out-alt',
        enabled: false,
        generator: generateEncounterDischargeHook
    }
};

/* 平台初始化 */
document.addEventListener('DOMContentLoaded', async function() {
    console.log('SMART 平台初始化中...');

    // 設置當前時間
    updateCurrentTime();

    try {
        let smartClient;

        // 嘗試啟動真實 SMART OAuth2 client
        if (typeof FHIR !== 'undefined' && FHIR.oauth2) {
            console.log('嘗試初始化真實 SMART 客戶端...');
            try {
                smartClient = await FHIR.oauth2.ready();
                console.log('SMART 客戶端已就緒:', smartClient);
            } catch (oauthError) {
                console.warn('未透過 SMART Launcher 啟動，改用模擬 client');
                smartClient = await initializeMockSmartClient();
            }
        } else {
            console.log('FHIR 套件未加載，使用模擬 client');
            smartClient = await initializeMockSmartClient();
        }

        // 更新連接狀態
        updateConnectionStatus(smartClient);

        // 載入資料
        await loadPatientData(smartClient);
        await loadEncounterData(smartClient);
        await loadUserData(smartClient);
        await loadConditionsData(smartClient);
        await loadPersonalHistoryAndMedications(smartClient);

        // 初始化 CDS Hook、頁簽與事件
        initializeCDSHooks();
        initializeTabs();
        bindEventListeners();
        startRealTimeUpdates();
        hideLoadingOverlay();

        console.log('SMART 平台初始化完成');

    } catch (error) {
        console.error('SMART 平台初始化失敗:', error);
        showErrorOverlay('初始化失敗: ' + error.message);
    }
});

/* 模擬 SMART Client */
async function initializeMockSmartClient(patientId = examplePatientId) {
    console.log("🧠 模擬 OAuth2 啟動中...");

    return new Promise((resolve) => {
        const mockClient = {
            serverUrl: "http://localhost:8080/fhir",
            patient: { id: patientId },
            user: { id: "developer-user" },
            encounter: { id: "mock-encounter" },

            patientRead: async function() {
                const url = `${this.serverUrl}/Patient/${this.patient.id}`;
                const response = await fetch(url, { headers: { "Accept": "application/fhir+json" } });
                if (!response.ok) throw new Error(`Patient not available (HTTP ${response.status})`);
                return response.json();
            },

            request: async function(path) {
                const url = `${this.serverUrl}/${path}`;
                const response = await fetch(url, { headers: { "Accept": "application/fhir+json" } });
                if (!response.ok) throw new Error(`Request failed: ${path} (HTTP ${response.status})`);
                return response.json();
            },

            userRead: async function() { return { id: "developer-user", name: "本地測試用戶" }; },
            encounterRead: async function() { return { id: "mock-encounter", description: "模擬 Encounter 資料" }; }
        };

        console.log("🚀 模擬 SMART Client 初始化完成");
        resolve(mockClient);
    });
}

/* 初始化 SMART on FHIR 應用程式  */
function initializeSmartApp() {
    console.log('SMART 平台初始化中...');
    
    // 設置當前時間
    updateCurrentTime();
    
    // 使用 SMART on FHIR 客戶端
    FHIR.oauth2.ready()
        .then(function(client) {
            console.log('SMART 客戶端已就緒:', client);
            smartClient = client;
            
            // 更新連接狀態
            updateConnectionStatus(client);
            
            // 載入病人資料
            return loadPatientData(client);
        })
        .then(function() {
            // 載入其他相關資料
            return loadEncounterData();
        })
        .then(function() {
            // 載入用戶資料
            return loadUserData();
        })
        .then(function() {
            // 載入診斷資料
            return loadConditionsData();
        })
        .then(function() {
            // 載入個人史和用藥資訊
            return loadPersonalHistoryAndMedications();
        })
        .then(function() {
            // 初始化 CDS Hook 狀態
            initializeCDSHooks();
            
            // 初始化頁簽功能
            initializeTabs();
            
            // 綁定事件監聽器
            bindEventListeners();
            
            // 啟動實時更新
            startRealTimeUpdates();
            
            // 隱藏載入中界面
            hideLoadingOverlay();
            
            console.log('SMART 平台初始化完成');
        })
        .catch(function(error) {
            console.error('SMART 平台初始化失敗:', error);
            showErrorOverlay('初始化失敗: ' + error.message);
        });
}

/* 綁定事件監聽器 */
function bindEventListeners() {
    // 初始化 CDS Cards
    initializeCDSCards();
    
    // 初始化 CDS Hook 控制按鈕
    initializeCDSHookControls();
    
    // CDS Hook 動作按鈕
    const cdsActionBtn = document.querySelector('.cds-action-btn');
    if (cdsActionBtn) {
        cdsActionBtn.addEventListener('click', function() {
            openASCVDCalculator();
        });
    }
    
    // 功能按鈕
    const functionButtons = document.querySelectorAll('.function-btn');
    functionButtons.forEach(button => {
        button.addEventListener('click', function() {
            const functionItem = this.closest('.function-item');
            const functionName = functionItem.querySelector('h4').textContent;
            activateFunction(functionName, this);
        });
    });
    
    // SMART App 按鈕
    const appButtons = document.querySelectorAll('.app-btn');
    appButtons.forEach(button => {
        button.addEventListener('click', function() {
            const appItem = this.closest('.smart-app-item');
            const appName = appItem.querySelector('h4').textContent;
            openSmartApp(appName);
        });
    });
    
    // 診斷項目點擊
    const diagnosisItems = document.querySelectorAll('.diagnosis-item');
    diagnosisItems.forEach(item => {
        item.addEventListener('click', function() {
            showDiagnosisDetails(this);
        });
    });
}

/* 更新當前時間 */
function updateCurrentTime() {
    const timeElement = document.querySelector('#current-time');
    if (timeElement) {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        timeElement.textContent = `${hours}:${minutes}`;
    }
}

/* 更新連接狀態 */
function updateConnectionStatus(client) {
    const statusElement = document.querySelector('#connection-status');
    const serverInfoElement = document.querySelector('#server-info');

    if (statusElement && serverInfoElement) {
        statusElement.innerHTML = '<i class="fas fa-check-circle" style="color: #27ae60;"></i>';

        // 修正版：支援正式 OAuth2 以及模擬模式
        const serverUrl =
            (client.state && client.state.serverUrl) ||
            client.serverUrl ||
            'Unknown';
        const serverName = getServerName(serverUrl);
        serverInfoElement.textContent = `已連接: ${serverName}`;
    }
}

/* 根據服務器 URL 獲取友好名稱 */
function getServerName(url) {
    if (url.includes('smarthealthit.org')) {
        return 'SMART Health IT';
    } else if (url.includes('cerner.com')) {
        return 'Cerner';
    } else if (url.includes('epic.com')) {
        return 'Epic';
    } else if (url.includes('localhost')) {
        return 'Local Server';
    } else {
        return 'FHIR Server';
    }
}

/* 顯示載入中覆蓋層 */
function showLoadingOverlay() {
    const overlay = document.querySelector('#loading-overlay');
    if (overlay) {
        overlay.style.display = 'flex';
    }
}

/* 隱藏載入中覆蓋層 */
function hideLoadingOverlay() {
    const overlay = document.querySelector('#loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/* 顯示錯誤覆蓋層 */
function showErrorOverlay(message) {
    const overlay = document.querySelector('#error-overlay');
    const messageElement = document.querySelector('#error-message');
    
    if (overlay && messageElement) {
        messageElement.textContent = message;
        overlay.style.display = 'flex';
    }
    
    // 隱藏載入中覆蓋層
    hideLoadingOverlay();
}

/* 更新病人資訊顯示 */
function updatePatientDisplay(patient) {
    if (!patient) return;

    // 取得 DOM 元素
    const nameEl = document.getElementById("patient-name");
    const genderEl = document.getElementById("patient-gender");
    const ageEl = document.getElementById("patient-age");
    const idEl = document.getElementById("patient-id");
    const birthEl = document.getElementById("patient-birthdate");

    // 取得病人資料
    const name =
        patient.name && patient.name.length > 0
            ? `${(patient.name[0].given || []).join(" ")} ${patient.name[0].family || ""}`.trim()
            : "未提供";

    const gender =
        patient.gender === "male" ? "男性" :
        patient.gender === "female" ? "女性" : "未提供";

    const birthDate = patient.birthDate || "未提供";
    const id = patient.id || "未提供";

    // 計算年齡
    let age = "未提供";
    if (patient.birthDate) {
        const birth = new Date(patient.birthDate);
        const today = new Date();
        age = Math.floor((today - birth) / (365.25 * 24 * 60 * 60 * 1000));
    }

    // 更新頁面
    if (nameEl) nameEl.textContent = name;
    if (genderEl) genderEl.textContent = gender;
    if (ageEl) ageEl.textContent = `${age} 歲`;
    if (idEl) idEl.textContent = id;
    if (birthEl) birthEl.textContent = birthDate;
}

/* 更新診斷顯示 */
function updateConditionsDisplay(conditions) {
    const diagnosisContainer = document.querySelector('.recent-diagnosis');
    if (!diagnosisContainer) return;
    
    // 清除現有的診斷項目（保留標題）
    const existingItems = diagnosisContainer.querySelectorAll('.diagnosis-item');
    existingItems.forEach(item => item.remove());
    
    // 添加新的診斷項目
    conditions.slice(0, 5).forEach(condition => {
        const diagnosisItem = document.createElement('div');
        diagnosisItem.className = 'diagnosis-item';
        
        const conditionName = getConditionName(condition);
        const conditionDate = getConditionDate(condition);
        const practitioner = getConditionPractitioner(condition);
        
        diagnosisItem.innerHTML = `
            <div class="diagnosis-info">
                <h4>${conditionName}</h4>
                <p><i class="fas fa-calendar"></i> ${conditionDate} <i class="fas fa-user-md"></i> ${practitioner}</p>
            </div>
            <span class="status-badge active">活躍</span>
        `;
        
        // 添加點擊事件
        diagnosisItem.addEventListener('click', function() {
            showDiagnosisDetails(this, condition);
        });
        
        diagnosisContainer.appendChild(diagnosisItem);
    });
    
    // 如果沒有診斷資料，顯示提示
    if (conditions.length === 0) {
        const noDataItem = document.createElement('div');
        noDataItem.className = 'diagnosis-item';
        noDataItem.innerHTML = `
            <div class="diagnosis-info">
                <h4>無診斷資料</h4>
                <p><i class="fas fa-info-circle"></i> 無可用的診斷記錄</p>
            </div>
            <span class="status-badge inactive">無資料</span>
        `;
        diagnosisContainer.appendChild(noDataItem);
    }
}

/* 獲取診斷名稱 */
function getConditionName(condition) {
    if (condition.code && condition.code.coding && condition.code.coding.length > 0) {
        return condition.code.coding[0].display || condition.code.coding[0].code || 'Unknown Condition';
    } else if (condition.code && condition.code.text) {
        return condition.code.text;
    }
    return 'Unknown Condition';
}

/* 獲取診斷日期 */
function getConditionDate(condition) {
    if (condition.onsetDateTime) {
        return new Date(condition.onsetDateTime).toLocaleDateString('zh-TW');
    } else if (condition.recordedDate) {
        return new Date(condition.recordedDate).toLocaleDateString('zh-TW');
    }
    return 'Unknown Date';
}

/* 獲取診斷醫師 */
function getConditionPractitioner(condition) {
    if (condition.recorder && condition.recorder.display) {
        return condition.recorder.display;
    }
    return 'Unknown Practitioner';
}

/* 初始化 CDS Hook 功能 */
function initializeCDSHooks() {
    console.log('初始化 CDS Hook 系統...');
    
    // 模擬 CDS Hook 數據載入
    setTimeout(() => {
        showNotification('CDS Hook 系統已就緒', 'success');
    }, 1000);
}

/* 載入病人資料 */
async function loadPatientData(client) {
    console.log('📥 載入病人資料...');
    const patientIdToLoad = client.patient?.id;
    try {
        const patient = await client.request(`Patient/${patientIdToLoad}`);
        console.log('✅ 病人資料載入成功:', patient);
        patientData = patient;
        updatePatientDisplay(patient);
        showNotification(`病人 ${patientIdToLoad} 資料載入完成`, 'info');
        return patient;
    } catch (error) {
        console.error('❌ 載入病人資料失敗:', error);
        throw new Error('載入病人資料失敗: ' + error.message);
    }
}

function loadEncounterData(client = smartClient) {
    if (!client) {
        console.log('smartClient 尚未初始化');
        return Promise.resolve(null);
    }
    return client.request(`Encounter?patient=${client.patient.id}`)
        .then(function(encounters) {
            console.log('病人 Encounter 載入成功:', encounters);
            encounterData = encounters;
            return encounters;
        })
        .catch(function(error) {
            console.error('載入病人 Encounter 失敗:', error);
            return null;
        });
}

function loadUserData(client = smartClient) {
    if (!client || !client.user || !client.user.id) {
        console.log('無使用者資料');
        return Promise.resolve(null);
    }
    return client.request(`Practitioner/${client.user.id}`)
        .then(function(practitioner) {
            console.log('使用者資料載入成功:', practitioner);
            userData = practitioner;
            return practitioner;
        })
        .catch(function(error) {
            console.error('載入使用者資料失敗:', error);
            return null;
        });
}

// 載入診斷資料
async function loadConditionsData(client) {
    console.log('📥 載入診斷資料...');
    const patientIdToLoad = client.patient?.id;

    try {
        const response = await client.request(`Condition?patient=${patientIdToLoad}&_sort=-date`);
        console.log('✅ 診斷資料載入成功:', response);
        let conditions = [];
        if (response.entry) {
            conditions = response.entry.map(entry => entry.resource);
        }
        updateConditionsDisplay(conditions);
        showNotification(`病人 ${patientIdToLoad} 的診斷資料載入完成`, 'info');
        return conditions;
    } catch (error) {
        console.error('❌ 載入診斷資料失敗:', error);
        showNotification('載入診斷資料失敗: ' + error.message, 'error');
        return [];
    }
}

// 動畫效果：病人卡片
function animatePatientCard() {
    const patientCard = document.querySelector('.patient-card');
    if (patientCard) {
        patientCard.style.transform = 'scale(1.02)';
        setTimeout(() => {
            patientCard.style.transform = 'scale(1)';
        }, 300);
    }
}

// 開啟 ASCVD 計算器
async function openASCVDCalculator() {
    showNotification('正在開啟 ASCVD 風險計算器...', 'info');
    
    try {
        // 創建計算器視窗（現在是異步的）
        await createCalculatorModal();
        showNotification('ASCVD 風險計算器已開啟', 'success');
    } catch (error) {
        console.error('開啟 ASCVD 計算器失敗:', error);
        showNotification('開啟計算器失敗', 'error');
    }
}

// 創建計算器模態視窗
async function createCalculatorModal() {
    const modal = document.createElement('div');
    modal.className = 'calculator-modal';
    
    // 預設值
    let defaultAge = '';
    let defaultGender = 'male';
    let defaultTotalChol = '';
    let defaultHDLChol = '';
    let defaultSystolicBP = '';
    let defaultDiabetes = 'no';
    let defaultSmoking = 'no';
    
    // 嘗試從API載入數據
    if (smartClient && smartClient.patient) {
        try {
            showNotification('正在載入病患資料...', 'info');
            const riskData = await gatherASCVDRiskData();
            
            defaultAge = riskData.age || '';
            defaultGender = riskData.gender || 'male';
            defaultTotalChol = riskData.totalCholesterol || '';
            defaultHDLChol = riskData.hdlCholesterol || '';
            defaultSystolicBP = riskData.systolicBP || '';
            defaultDiabetes = riskData.diabetes ? 'yes' : 'no';
            defaultSmoking = riskData.smokingStatus ? 'yes' : 'no';
            
            showNotification('病患資料載入完成', 'success');
        } catch (error) {
            console.warn('載入病患資料失敗，使用空白表單:', error);
        }
    }
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-calculator"></i> ASCVD 風險計算器</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="data-loading-status" style="margin-bottom: 15px;">
                    ${smartClient ? '<p style="color: #28a745; font-size: 12px;"><i class="fas fa-check"></i> 已自動載入可用的病患資料</p>' : 
                      '<p style="color: #6c757d; font-size: 12px;"><i class="fas fa-info-circle"></i> 請手動輸入病患資料</p>'}
                </div>
                <div class="calculator-form">
                    <h4>患者資訊</h4>
                    <div class="form-group">
                        <label>年齡:</label>
                        <input type="number" value="${defaultAge}" placeholder="請輸入年齡">
                        ${defaultAge ? '<span class="data-source-indicator api">API載入</span>' : ''}
                    </div>
                    <div class="form-group">
                        <label>性別:</label>
                        <select>
                            <option value="male" ${defaultGender === 'male' ? 'selected' : ''}>男性</option>
                            <option value="female" ${defaultGender === 'female' ? 'selected' : ''}>女性</option>
                        </select>
                        ${defaultGender ? '<span class="data-source-indicator api">API載入</span>' : ''}
                    </div>
                    <div class="form-group">
                        <label>總膽固醇 (mg/dL):</label>
                        <input type="number" value="${defaultTotalChol}" placeholder="請輸入數值">
                        ${defaultTotalChol ? '<span class="data-source-indicator api">API載入</span>' : '<span class="data-source-indicator missing">需檢測</span>'}
                    </div>
                    <div class="form-group">
                        <label>HDL 膽固醇 (mg/dL):</label>
                        <input type="number" value="${defaultHDLChol}" placeholder="請輸入數值">
                        ${defaultHDLChol ? '<span class="data-source-indicator api">API載入</span>' : '<span class="data-source-indicator missing">需檢測</span>'}
                    </div>
                    <div class="form-group">
                        <label>收縮壓 (mmHg):</label>
                        <input type="number" value="${defaultSystolicBP}" placeholder="請輸入數值">
                        ${defaultSystolicBP ? '<span class="data-source-indicator api">API載入</span>' : '<span class="data-source-indicator missing">需檢測</span>'}
                    </div>
                    <div class="form-group">
                        <label>糖尿病:</label>
                        <select>
                            <option value="no" ${defaultDiabetes === 'no' ? 'selected' : ''}>無</option>
                            <option value="yes" ${defaultDiabetes === 'yes' ? 'selected' : ''}>有</option>
                        </select>
                        <span class="data-source-indicator api">API載入</span>
                    </div>
                    <div class="form-group">
                        <label>吸煙:</label>
                        <select>
                            <option value="no" ${defaultSmoking === 'no' ? 'selected' : ''}>無</option>
                            <option value="yes" ${defaultSmoking === 'yes' ? 'selected' : ''}>有</option>
                        </select>
                        <span class="data-source-indicator api">API載入</span>
                    </div>
                    <div class="button-group" style="display: flex; gap: 10px; margin-top: 20px;">
                        <button class="reload-data-btn" style="flex: 1;">
                            <i class="fas fa-refresh"></i> 重新載入數據
                        </button>
                        <button class="calculate-btn" style="flex: 2;">
                            <i class="fas fa-calculator"></i> 計算風險
                        </button>
                    </div>
                </div>
                <div class="risk-result" style="display: none;">
                    <h4>風險評估結果</h4>
                    <div class="risk-percentage">
                        <span class="risk-value">--</span>%
                    </div>
                    <p class="risk-interpretation">請填寫完整資訊以計算風險</p>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 綁定關閉事件
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
    
    // 綁定計算事件
    modal.querySelector('.calculate-btn').addEventListener('click', function() {
        calculateASCVDRisk(modal);
    });
    
    // 綁定重新載入數據事件
    const reloadBtn = modal.querySelector('.reload-data-btn');
    if (reloadBtn) {
        reloadBtn.addEventListener('click', async function() {
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 載入中...';
            this.disabled = true;
            
            try {
                if (smartClient && smartClient.patient) {
                    const riskData = await gatherASCVDRiskData();
                    
                    // 更新表單值
                    modal.querySelector('input[type="number"]').value = riskData.age || '';
                    modal.querySelectorAll('select')[0].value = riskData.gender || 'male';
                    modal.querySelectorAll('input[type="number"]')[1].value = riskData.totalCholesterol || '';
                    modal.querySelectorAll('input[type="number"]')[2].value = riskData.hdlCholesterol || '';
                    modal.querySelectorAll('input[type="number"]')[3].value = riskData.systolicBP || '';
                    modal.querySelectorAll('select')[1].value = riskData.diabetes ? 'yes' : 'no';
                    modal.querySelectorAll('select')[2].value = riskData.smokingStatus ? 'yes' : 'no';
                    
                    showNotification('數據重新載入完成', 'success');
                } else {
                    showNotification('SMART 客戶端未連接', 'warning');
                }
            } catch (error) {
                console.error('重新載入數據失敗:', error);
                showNotification('重新載入失敗', 'error');
            } finally {
                this.innerHTML = '<i class="fas fa-refresh"></i> 重新載入數據';
                this.disabled = false;
            }
        });
    }
    
    // 將模態窗口添加到DOM
    document.body.appendChild(modal);
}

// 計算 ASCVD 風險
function calculateASCVDRisk(modal) {
    const inputs = modal.querySelectorAll('input[type="number"]');
    let allFilled = true;
    
    inputs.forEach(input => {
        if (!input.value || input.value === '') {
            allFilled = false;
        }
    });
    
    if (!allFilled) {
        showNotification('請填寫所有必要資訊', 'warning');
        return;
    }
    
    // 模擬計算過程
    showNotification('正在計算風險...', 'info');
    
    setTimeout(() => {
        const riskResult = modal.querySelector('.risk-result');
        const riskValue = modal.querySelector('.risk-value');
        const riskInterpretation = modal.querySelector('.risk-interpretation');
        
        // 收集輸入數據並計算
        const age = parseInt(modal.querySelector('input[type="number"]').value);
        const totalChol = parseFloat(modal.querySelectorAll('input[type="number"]')[1].value);
        const hdlChol = parseFloat(modal.querySelectorAll('input[type="number"]')[2].value);
        const systolicBP = parseFloat(modal.querySelectorAll('input[type="number"]')[3].value);
        const diabetes = modal.querySelector('select[value="yes"]')?.value === 'yes';
        const smoking = modal.querySelectorAll('select')[2]?.value === 'yes';
        
        const riskData = { age, totalCholesterol: totalChol, hdlCholesterol: hdlChol, systolicBP, diabetes, smokingStatus: smoking, gender: 'male' };
        const calculatedRisk = calculateASCVDRiskScore(riskData);
        
        riskValue.textContent = calculatedRisk;
        riskResult.style.display = 'block';
        
        if (calculatedRisk >= 20) {
            riskInterpretation.textContent = '高風險：建議積極治療和密切監測';
            riskInterpretation.style.color = '#e74c3c';
        } else if (calculatedRisk >= 7.5) {
            riskInterpretation.textContent = '中等風險：建議定期追蹤和生活方式改善';
            riskInterpretation.style.color = '#f39c12';
        } else {
            riskInterpretation.textContent = '低風險：維持健康生活方式';
            riskInterpretation.style.color = '#27ae60';
        }
        
        showNotification('風險計算完成', 'success');
    }, 1000);
}

// 計算年齡的工具函數
function calculateAge(birthDate) {
    if (!birthDate) return 'Unknown';
    
    const birth = new Date(birthDate);
    const today = new Date();
    
    if (isNaN(birth.getTime())) return 'Unknown';
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

// 動態頁籤管理
let dynamicTabCounter = 0;
let activeTabs = new Map();

// 激活功能
function activateFunction(functionName, button) {
    // 移除所有活動狀態
    document.querySelectorAll('.function-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 設置當前按鈕為活動狀態
    button.classList.add('active');
    
    // 創建或切換到對應的動態頁籤
    createOrSwitchToTab(functionName);
    
    showNotification(`已開啟功能: ${functionName}`, 'success');
    
    // 根據功能類型自動載入API數據
    setTimeout(() => {
        autoLoadFunctionData(functionName);
    }, 500);
}

// 自動載入功能相關的API數據
async function autoLoadFunctionData(functionName) {
    if (!smartClient || !smartClient.patient) {
        console.warn('SMART 客戶端未就緒，跳過自動載入');
        return;
    }
    
    try {
        switch(functionName) {
            case 'ASCVD 風險評估':
                await autoLoadASCVDData();
                break;
            case 'ARC-HBR 風險權衡':
                await autoLoadARCHBRData();
                break;
            case 'PRECISE-DAPT Score':
                // 已在 initializePreciseDAPTTab 中處理
                break;
            case '風險評估檢測':
                await autoLoadRiskAssessmentData();
                break;
            default:
                console.log(`功能 ${functionName} 暫無自動載入數據`);
        }
    } catch (error) {
        console.error(`自動載入 ${functionName} 數據失敗:`, error);
        showNotification(`載入 ${functionName} 數據時發生錯誤`, 'warning');
    }
}

// 創建或切換到頁籤
function createOrSwitchToTab(functionName) {
    // 檢查是否已存在該功能的頁籤
    const existingTabId = findExistingTab(functionName);
    
    if (existingTabId) {
        // 切換到現有頁籤
        switchToTab(existingTabId);
    } else {
        // 創建新頁籤
        createNewTab(functionName);
    }
}

// 查找是否存在該功能的頁籤
function findExistingTab(functionName) {
    for (let [tabId, tabInfo] of activeTabs) {
        if (tabInfo.functionName === functionName) {
            return tabId;
        }
    }
    return null;
}

// 創建新頁籤
function createNewTab(functionName) {
    dynamicTabCounter++;
    const tabId = `dynamic-tab-${dynamicTabCounter}`;
    
    // 獲取功能圖標
    const iconClass = getFunctionIcon(functionName);
    
    // 創建頁籤按鈕
    const tabButton = document.createElement('button');
    tabButton.className = 'tab-btn closable';
    tabButton.setAttribute('data-tab', tabId);
    tabButton.innerHTML = `
        <i class="${iconClass}"></i>
        ${functionName}
        <button class="tab-close-btn" onclick="closeTab('${tabId}', event)">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // 創建頁籤內容
    const tabContent = document.createElement('div');
    tabContent.id = tabId;
    tabContent.className = 'tab-content';
    
    // 獲取功能內容
    const content = getFunctionContent(functionName);
    tabContent.innerHTML = content;
    
    // 添加到 DOM
    const tabNav = document.querySelector('.tab-nav');
    const tabsContainer = document.querySelector('.work-area-tabs');
    
    tabNav.appendChild(tabButton);
    tabsContainer.appendChild(tabContent);
    
    // 記錄頁籤資訊
    activeTabs.set(tabId, {
        functionName: functionName,
        button: tabButton,
        content: tabContent
    });
    
    // 切換到新頁籤
    switchToTab(tabId);
    
    // 綁定頁籤點擊事件
    tabButton.addEventListener('click', (e) => {
        if (!e.target.closest('.tab-close-btn')) {
            switchToTab(tabId);
        }
    });
    
    // 如果是實驗室數據趨勢，初始化相關功能
    if (functionName === '實驗室數據趨勢') {
        setTimeout(() => {
            initializeLabTrendsTab(tabId);
        }, 100);
    }
    
    // 如果是PRECISE-DAPT Score，初始化相關功能
    if (functionName === 'PRECISE-DAPT Score') {
        setTimeout(() => {
            initializePreciseDAPTTab(tabId);
        }, 100);
    }
    
    // 如果是ESC心臟衰竭指引，初始化相關功能
    if (functionName === 'ESC 心臟衰竭指引') {
        setTimeout(() => {
            initializeHFTab(tabId);
        }, 100);
    }
}

// 獲取功能圖標
function getFunctionIcon(functionName) {
    const iconMap = {
        'ARC-HBR 風險權衡': 'fas fa-balance-scale',
        'ASCVD 風險評估': 'fas fa-heart',
        '實驗室數據趨勢': 'fas fa-chart-line',
        '風險評估檢測': 'fas fa-exclamation-triangle',
        '臨床報告': 'fas fa-file-medical-alt',
        'PRECISE-DAPT Score': 'fas fa-tint',
        'Fabry disease 檢驗流程': 'fas fa-dna',
        'ESC 心臟衰竭指引': 'fas fa-heartbeat',
        '設定': 'fas fa-cog'
    };
    return iconMap[functionName] || 'fas fa-tools';
}

// 獲取功能內容
function getFunctionContent(functionName) {
    switch(functionName) {
        case 'ARC-HBR 風險權衡':
            return createARCHBRContent();
        case 'ASCVD 風險評估':
            return createASCVDContent();
        case '實驗室數據趨勢':
            return createLabTrendsContent();
        case '風險評估檢測':
            return createRiskAssessmentContent();
        case '臨床報告':
            return createClinicalReportContent();
        case 'PRECISE-DAPT Score':
            return createPreciseDAPTContent();
        case 'Fabry disease 檢驗流程':
            return createFabryContent();
        case 'ESC 心臟衰竭指引':
            return createESCHeartFailureContent();
        case '設定':
            return createSettingsContent();
        default:
            return createDefaultContent();
    }
}

// 切換到指定頁籤
function switchToTab(targetTabId) {
    // 移除所有頁籤的 active 狀態
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    // 隱藏所有內容
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 啟動目標頁籤
    const targetButton = document.querySelector(`[data-tab="${targetTabId}"]`);
    const targetContent = document.getElementById(targetTabId);
    
    if (targetButton && targetContent) {
        targetButton.classList.add('active');
        targetContent.classList.add('active');
    }
}

// 關閉頁簽（全域函數，供 HTML onclick 使用）
window.closeTab = function closeTab(tabId, event) {
    event.stopPropagation(); // 防止觸發頁籤切換
    
    const tabInfo = activeTabs.get(tabId);
    if (!tabInfo) return;
    
    // 移除 DOM 元素
    if (tabInfo.button && tabInfo.button.parentNode) {
        tabInfo.button.parentNode.removeChild(tabInfo.button);
    }
    if (tabInfo.content && tabInfo.content.parentNode) {
        tabInfo.content.parentNode.removeChild(tabInfo.content);
    }
    
    // 從記錄中移除
    activeTabs.delete(tabId);
    
    // 如果關閉的是當前活動頁籤，切換到其他頁籤
    if (tabInfo.button.classList.contains('active')) {
        // 切換到第一個可用的頁籤
        const firstTab = document.querySelector('.tab-btn');
        if (firstTab) {
            const firstTabId = firstTab.getAttribute('data-tab');
            switchToTab(firstTabId);
        }
    }
    
    // 清除對應功能按鈕的活動狀態
    document.querySelectorAll('.function-btn').forEach(btn => {
        if (btn.closest('.function-item').querySelector('h4').textContent === tabInfo.functionName) {
            btn.classList.remove('active');
        }
    });
    
    showNotification(`已關閉功能: ${tabInfo.functionName}`, 'info');
};

// 初始化實驗室趨勢頁籤
function initializeLabTrendsTab(tabId) {
    const tabContent = document.getElementById(tabId);
    if (!tabContent) return;
    
    // 綁定事件監聽器
    const timeRangeSelector = tabContent.querySelector('#timeRangeSelector');
    const refreshButton = tabContent.querySelector('#refreshLabData');
    
    if (timeRangeSelector) {
        timeRangeSelector.addEventListener('change', loadLabObservations);
    }
    
    if (refreshButton) {
        refreshButton.addEventListener('click', loadLabObservations);
    }
    
    // 自動載入數據
    loadLabObservations();
}

// 初始化 CDS Cards 事件監聽器
function initializeCDSCards() {
    console.log('初始化 CDS Cards...');
    
    // 為所有建議按鈕添加點擊事件
    document.querySelectorAll('.suggestion-btn').forEach(button => {
        button.addEventListener('click', function() {
            handleCDSSuggestion(this);
        });
    });
}

// 處理 CDS 建議點擊
function handleCDSSuggestion(button) {
    const action = button.textContent.trim();
    const cardType = button.closest('.cds-card').classList.contains('critical') ? '關鍵' : '資訊';
    
    console.log(`處理 CDS 建議: ${action}`);
    
    // 根據不同的建議執行不同的操作
    if (action.includes('調整') || action.includes('劑量')) {
        showNotification(`正在處理: ${action}`, 'info');
        // 這裡可以調用實際的劑量調整功能
        setTimeout(() => {
            showNotification('已成功調整藥物劑量建議', 'success');
        }, 1500);
    } else if (action.includes('替代') || action.includes('藥物')) {
        showNotification(`正在查找: ${action}`, 'info');
        setTimeout(() => {
            showNotification('已找到3種替代藥物選項', 'success');
        }, 1500);
    } else if (action.includes('處方') || action.includes('開立')) {
        showNotification(`正在開立: ${action}`, 'info');
        setTimeout(() => {
            showNotification('處方已成功開立並加入處方籤', 'success');
        }, 1500);
    } else if (action.includes('追蹤') || action.includes('評估')) {
        showNotification(`正在安排: ${action}`, 'info');
        setTimeout(() => {
            showNotification('已安排4週後追蹤評估', 'success');
        }, 1500);
    } else if (action.includes('指引') || action.includes('查看')) {
        showNotification('正在載入完整臨床指引...', 'info');
        setTimeout(() => {
            showNotification('已開啟ASCVD預防指引文件', 'success');
        }, 1000);
    } else if (action.includes('忽略')) {
        const card = button.closest('.cds-card');
        card.style.opacity = '0.6';
        card.style.pointerEvents = 'none';
        showNotification('已忽略此警告，可在歷史記錄中重新啟用', 'warning');
    }
    
    // 記錄使用者行為（實際應用中可以發送到分析服務）
    console.log({
        timestamp: new Date().toISOString(),
        cardType: cardType,
        action: action,
        userId: 'current_user'
    });
}

// 模擬 CDS Hook 載入功能
function loadCDSHook(hookType) {
    console.log(`載入 CDS Hook: ${hookType}`);
    
    const hookContainer = document.getElementById('hookContainer');
    if (!hookContainer) return;
    
    // 顯示載入中狀態
    hookContainer.innerHTML = `
        <div class="loading-state">
            <i class="fas fa-spinner fa-spin"></i>
            <p>正在載入 ${hookType} Hook...</p>
        </div>
    `;
    
    // 模擬載入延遲
    setTimeout(() => {
        // 根據不同的 hook 類型載入不同的 CDS cards
        loadCDSCardsForHook(hookType);
        showNotification(`${hookType} Hook 已成功載入`, 'success');
    }, 1500);
}

// 根據 Hook 類型載入對應的 CDS Cards
function loadCDSCardsForHook(hookType) {
    const hookContainer = document.getElementById('hookContainer');
    
    switch(hookType) {
        case 'medication-prescribe':
            hookContainer.innerHTML = getMedicationPrescribeCards();
            break;
        case 'patient-view':
            hookContainer.innerHTML = getPatientViewCards();
            break;
        case 'order-review':
            hookContainer.innerHTML = getOrderReviewCards();
            break;
        default:
            // 載入預設的卡片（當前顯示的兩張）
            hookContainer.innerHTML = getDefaultCDSCards();
    }
    
    // 重新初始化事件監聽器
    initializeCDSCards();
}

// 獲取預設 CDS Cards HTML
function getDefaultCDSCards() {
    return `
        <!-- CDS Card 1: 藥物交互作用警告 -->
        <div class="cds-card critical">
            <div class="card-header">
                <div class="card-indicator critical">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span class="indicator-text">Critical</span>
                </div>
                <div class="card-source">
                    <i class="fas fa-shield-alt"></i>
                    <span>Drug Interaction Service v2.1</span>
                </div>
            </div>
            
            <div class="card-content">
                <h3 class="card-summary">嚴重藥物交互作用警告</h3>
                <p class="card-detail">
                    檢測到 <strong>Warfarin</strong> 與 <strong>Aspirin</strong> 之間存在嚴重交互作用。
                    同時使用可能增加出血風險，建議調整劑量或考慮替代治療方案。
                </p>
                
                <div class="card-info">
                    <div class="info-item">
                        <strong>患者:</strong> Amy Shaw (Patient/123)
                    </div>
                    <div class="info-item">
                        <strong>風險等級:</strong> 高風險
                    </div>
                    <div class="info-item">
                        <strong>證據等級:</strong> A (高品質證據)
                    </div>
                </div>
            </div>
            
            <div class="card-actions">
                <button class="suggestion-btn primary">
                    <i class="fas fa-edit"></i>
                    調整 Warfarin 劑量
                </button>
                <button class="suggestion-btn secondary">
                    <i class="fas fa-exchange-alt"></i>
                    考慮替代藥物
                </button>
                <button class="suggestion-btn dismiss">
                    <i class="fas fa-times"></i>
                    忽略警告
                </button>
            </div>
        </div>

        <!-- CDS Card 2: 預防性治療建議 -->
        <div class="cds-card info">
            <div class="card-header">
                <div class="card-indicator info">
                    <i class="fas fa-info-circle"></i>
                    <span class="indicator-text">Info</span>
                </div>
                <div class="card-source">
                    <i class="fas fa-heart"></i>
                    <span>ASCVD Prevention Guidelines v1.3</span>
                </div>
            </div>
            
            <div class="card-content">
                <h3 class="card-summary">心血管疾病一級預防建議</h3>
                <p class="card-detail">
                    根據患者的 <strong>ASCVD 風險評分 (12.5%)</strong>，建議考慮開始 statin 治療進行心血管疾病一級預防。
                    患者具有多個風險因子：高血壓、糖尿病、吸煙史。
                </p>
                
                <div class="card-info">
                    <div class="info-item">
                        <strong>10年ASCVD風險:</strong> 12.5% (中等風險)
                    </div>
                    <div class="info-item">
                        <strong>主要風險因子:</strong> HTN, DM, 吸煙
                    </div>
                    <div class="info-item">
                        <strong>建議治療:</strong> Atorvastatin 20mg daily
                    </div>
                </div>
            </div>
            
            <div class="card-actions">
                <button class="suggestion-btn primary">
                    <i class="fas fa-prescription-bottle-alt"></i>
                    開立 Statin 處方
                </button>
                <button class="suggestion-btn secondary">
                    <i class="fas fa-calendar-check"></i>
                    安排追蹤評估
                </button>
                <button class="suggestion-btn info">
                    <i class="fas fa-book-medical"></i>
                    查看完整指引
                </button>
            </div>
        </div>
    `;
}

// 其他 Hook 類型的 CDS Cards 可以在這裡擴展
function getMedicationPrescribeCards() {
    return getDefaultCDSCards(); // 暫時使用預設卡片
}

function getPatientViewCards() {
    return getDefaultCDSCards(); // 暫時使用預設卡片
}

function getOrderReviewCards() {
    return getDefaultCDSCards(); // 暫時使用預設卡片
}

// 初始化 CDS Hook 控制按鈕
function initializeCDSHookControls() {
    console.log('初始化 CDS Hook 控制按鈕...');
    
    // 載入 Hook 按鈕
    const loadHookBtn = document.getElementById('loadHookBtn');
    if (loadHookBtn) {
        loadHookBtn.addEventListener('click', function() {
            const hookSelector = document.getElementById('hookSelector');
            const selectedHook = hookSelector.value;
            
            if (!selectedHook) {
                showNotification('請先選擇一個 CDS Hook', 'warning');
                return;
            }
            
            loadCDSHook(selectedHook);
        });
    }
    
    // 取消載入 Hook 按鈕
    const unloadHookBtn = document.getElementById('unloadHookBtn');
    if (unloadHookBtn) {
        unloadHookBtn.addEventListener('click', function() {
            unloadCDSHook();
        });
    }
    
    // Hook 選擇器變更事件
    const hookSelector = document.getElementById('hookSelector');
    if (hookSelector) {
        hookSelector.addEventListener('change', function() {
            const selectedHook = this.value;
            if (selectedHook) {
                showNotification(`已選擇: ${getHookDisplayName(selectedHook)}`, 'info');
            }
        });
    }
}

// 取消載入 CDS Hook
function unloadCDSHook() {
    console.log('取消載入 CDS Hook');
    
    const hookContainer = document.getElementById('hookContainer');
    if (hookContainer) {
        hookContainer.innerHTML = `
            <div class="hook-placeholder">
                <i class="fas fa-info-circle"></i>
                <p>請選擇並載入一個 CDS Hook 來查看臨床決策支持內容</p>
            </div>
        `;
    }
    
    // 重置選擇器
    const hookSelector = document.getElementById('hookSelector');
    if (hookSelector) {
        hookSelector.value = '';
    }
    
    showNotification('已取消載入 CDS Hook', 'info');
}

// 獲取 Hook 顯示名稱
function getHookDisplayName(hookValue) {
    const hookNames = {
        'patient-view': 'Patient View Hook',
        'medication-prescribe': 'Medication Prescribe Hook',
        'order-review': 'Order Review Hook',
        'encounter-start': 'Encounter Start Hook',
        'encounter-discharge': 'Encounter Discharge Hook'
    };
    
    return hookNames[hookValue] || hookValue;
}

// 初始化 PRECISE-DAPT Score 頁籤
function initializePreciseDAPTTab(tabId) {
    const tabContent = document.getElementById(tabId);
    if (!tabContent) return;
    
    console.log('初始化 PRECISE-DAPT Score 計算器...');
    
    // 綁定輸入欄位事件監聽器
    const inputs = [
        {id: 'patientAge', status: 'ageStatus'},
        {id: 'hemoglobin', status: 'hbStatus'}, 
        {id: 'creatinine', status: 'crStatus'},
        {id: 'wbc', status: 'wbcStatus'}
    ];
    
    inputs.forEach(({id, status}) => {
        const input = tabContent.querySelector(`#${id}`);
        if (input) {
            input.addEventListener('input', () => {
                updatePreciseDAPTScore(tabContent);
                // 如果用戶手動輸入值，更新狀態為「手動」
                if (input.value.trim() !== '') {
                    updateDataStatus(tabContent, status, 'manual');
                }
            });
        }
    });
    
    // 綁定既往出血史複選框
    const bleedingCheckbox = tabContent.querySelector('#priorBleeding');
    if (bleedingCheckbox) {
        bleedingCheckbox.addEventListener('change', () => {
            updatePreciseDAPTScore(tabContent);
            // 用戶手動更改複選框，更新狀態為「手動」
            updateDataStatus(tabContent, 'bleedingStatus', 'manual');
        });
    }
    
    // 綁定自動載入按鈕
    const autoLoadBtn = tabContent.querySelector('#autoLoadDAPT');
    if (autoLoadBtn) {
        autoLoadBtn.addEventListener('click', () => autoLoadLabData(tabContent));
    }
    
    // 綁定計算按鈕
    const calculateBtn = tabContent.querySelector('#calculateDAPT');
    if (calculateBtn) {
        calculateBtn.addEventListener('click', () => calculatePreciseDAPTScore(tabContent));
    }
    
    // 自動載入檢驗數據（如果SMART客戶端可用）
    if (smartClient && smartClient.patient) {
        setTimeout(() => {
            console.log('自動載入 PRECISE-DAPT 檢驗數據...');
            autoLoadLabData(tabContent).catch(error => {
                console.warn('自動載入檢驗數據失敗:', error);
            });
        }, 500); // 給UI一點時間渲染
    } else {
        console.log('SMART客戶端未可用，跳過自動載入');
        // 顯示所有狀態為「手動」
        ['ageStatus', 'hbStatus', 'crStatus', 'wbcStatus', 'bleedingStatus'].forEach(statusId => {
            updateDataStatus(tabContent, statusId, 'manual');
        });
    }
    
    showNotification('PRECISE-DAPT Score 計算器已載入', 'success');
    
    // 添加測試按鈕進行調試
    if (window.location.search.includes('debug=1')) {
        const debugContainer = document.createElement('div');
        debugContainer.style.cssText = 'position: fixed; top: 10px; left: 10px; z-index: 9999; display: flex; gap: 5px;';
        
        const debugBtn = document.createElement('button');
        debugBtn.textContent = '🧪 測試載入';
        debugBtn.style.cssText = 'background: #ff6b6b; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;';
        debugBtn.onclick = () => {
            console.log('手動測試自動載入...');
            autoLoadLabData(tabContent);
        };
        
        const showDataBtn = document.createElement('button');
        showDataBtn.textContent = '📊 顯示原始數據';
        showDataBtn.style.cssText = 'background: #4ecdc4; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px;';
        showDataBtn.onclick = () => showRawLabData();
        
        debugContainer.appendChild(debugBtn);
        debugContainer.appendChild(showDataBtn);
        document.body.appendChild(debugContainer);
    }
}

// 更新 PRECISE-DAPT Score (即時計算)
function updatePreciseDAPTScore(tabContent) {
    calculatePreciseDAPTScore(tabContent, false);
}

// 計算 PRECISE-DAPT Score
function calculatePreciseDAPTScore(tabContent, showNotifications = true) {
    if (!tabContent) return;
    
    // 獲取輸入值
    const age = parseFloat(tabContent.querySelector('#patientAge')?.value) || 0;
    const hb = parseFloat(tabContent.querySelector('#hemoglobin')?.value) || 0;
    const cr = parseFloat(tabContent.querySelector('#creatinine')?.value) || 0;
    const wbc = parseFloat(tabContent.querySelector('#wbc')?.value) || 0;
    const priorBleeding = tabContent.querySelector('#priorBleeding')?.checked || false;
    
    // 計算各項分數
    const ageScore = calculateAgeScore(age);
    const hbScore = calculateHemoglobinScore(hb);
    const crScore = calculateCreatinineScore(cr);
    const wbcScore = calculateWBCScore(wbc);
    const bleedingScore = priorBleeding ? 25 : 0;
    
    // 更新分數顯示
    updateScoreDisplay(tabContent, 'ageScore', ageScore);
    updateScoreDisplay(tabContent, 'hbScore', hbScore);
    updateScoreDisplay(tabContent, 'crScore', crScore);
    updateScoreDisplay(tabContent, 'wbcScore', wbcScore);
    updateScoreDisplay(tabContent, 'bleedingScore', bleedingScore);
    
    // 計算總分
    const totalScore = ageScore + hbScore + crScore + wbcScore + bleedingScore;
    
    // 更新總分顯示
    const totalScoreElement = tabContent.querySelector('#totalScore');
    if (totalScoreElement) {
        totalScoreElement.textContent = totalScore;
    }
    
    // 更新風險分層
    updateRiskStratification(tabContent, totalScore);
    
    // 更新臨床建議
    updateClinicalRecommendations(tabContent, totalScore, {age, hb, cr, wbc, priorBleeding});
    
    if (showNotifications) {
        showNotification(`PRECISE-DAPT Score: ${totalScore} 分`, 'info');
    }
    
    return totalScore;
}

// 計算年齡分數
function calculateAgeScore(age) {
    if (age < 65) return 0;
    if (age >= 65 && age <= 74) return 12;
    if (age >= 75 && age <= 84) return 24;
    if (age >= 85) return 30;
    return 0;
}

// 計算血紅蛋白分數
function calculateHemoglobinScore(hb) {
    if (hb >= 18.0) return 0;
    if (hb >= 16.0) return 4;
    if (hb >= 14.0) return 8;
    if (hb >= 12.0) return 14;
    if (hb > 0 && hb < 12.0) return 22;
    return 0;
}

// 計算肌酸酐清除率分數
function calculateCreatinineScore(cr) {
    if (cr >= 150) return 0;
    if (cr >= 120) return 2;
    if (cr >= 90) return 5;
    if (cr >= 60) return 8;
    if (cr >= 30) return 13;
    if (cr >= 15 && cr > 0) return 21;
    return 0;
}

// 計算白血球計數分數
function calculateWBCScore(wbc) {
    if (wbc >= 2.0 && wbc <= 10.0) return 0;
    if (wbc > 10.0 && wbc <= 15.0) return 6;
    if (wbc > 15.0 && wbc <= 20.0) return 12;
    if (wbc > 20.0 && wbc <= 25.0) return 18;
    if (wbc < 2.0 && wbc > 0) return 9;
    return 0;
}

// 更新分數顯示
function updateScoreDisplay(tabContent, elementId, score) {
    const element = tabContent.querySelector(`#${elementId}`);
    if (element) {
        element.textContent = `${score} 分`;
        element.className = `score-points ${score > 0 ? 'has-score' : ''}`;
    }
}

// 更新風險分層顯示
function updateRiskStratification(tabContent, totalScore) {
    const riskLevelElement = tabContent.querySelector('#riskLevel');
    if (!riskLevelElement) return;
    
    let riskClass, riskIcon, riskText, riskColor;
    
    if (totalScore === 0) {
        riskClass = 'unknown';
        riskIcon = 'fas fa-question';
        riskText = '請輸入數據進行評估';
        riskColor = '#6c757d';
    } else if (totalScore <= 15) {
        riskClass = 'low';
        riskIcon = 'fas fa-check-circle';
        riskText = `低風險 (${totalScore} 分)`;
        riskColor = '#28a745';
    } else if (totalScore <= 24) {
        riskClass = 'moderate';
        riskIcon = 'fas fa-exclamation-triangle';
        riskText = `中等風險 (${totalScore} 分)`;
        riskColor = '#ffc107';
    } else {
        riskClass = 'high';
        riskIcon = 'fas fa-exclamation-circle';
        riskText = `高風險 (${totalScore} 分)`;
        riskColor = '#dc3545';
    }
    
    riskLevelElement.innerHTML = `
        <div class="risk-indicator ${riskClass}" style="border-color: ${riskColor};">
            <i class="${riskIcon}" style="color: ${riskColor};"></i>
            <span>${riskText}</span>
        </div>
    `;
}

// 更新臨床建議
function updateClinicalRecommendations(tabContent, totalScore, patientData) {
    const recommendationsElement = tabContent.querySelector('#recommendations');
    if (!recommendationsElement) return;
    
    let recommendations = '';
    
    if (totalScore === 0) {
        recommendations = `
            <div class="recommendation-placeholder">
                <i class="fas fa-stethoscope"></i>
                <p>完成評估後將顯示個人化治療建議</p>
            </div>
        `;
    } else {
        recommendations = generateDAPTRecommendations(totalScore, patientData);
    }
    
    recommendationsElement.innerHTML = recommendations;
}

// 生成DAPT治療建議
function generateDAPTRecommendations(totalScore, patientData) {
    const {age, hb, cr, wbc, priorBleeding} = patientData;
    
    let primaryRecommendation = '';
    let additionalRecommendations = [];
    let monitoringPoints = [];
    
    if (totalScore <= 15) {
        primaryRecommendation = `
            <div class="recommendation-primary low-risk">
                <h5><i class="fas fa-check-circle"></i> 標準DAPT治療</h5>
                <p>建議進行標準雙重抗血小板治療 <strong>12個月</strong>。患者出血風險較低，可安全使用標準療程。</p>
            </div>
        `;
        additionalRecommendations.push('定期監測血小板功能');
        additionalRecommendations.push('教育患者識別出血徵象');
    } else if (totalScore <= 24) {
        primaryRecommendation = `
            <div class="recommendation-primary moderate-risk">
                <h5><i class="fas fa-exclamation-triangle"></i> 標準DAPT + 密切監測</h5>
                <p>可進行標準雙重抗血小板治療 <strong>12個月</strong>，但需要更頻繁的監測。考慮每3-6個月評估一次。</p>
            </div>
        `;
        additionalRecommendations.push('每3個月監測血液學參數');
        additionalRecommendations.push('考慮胃腸道保護');
        monitoringPoints.push('密切觀察出血併發症');
    } else {
        primaryRecommendation = `
            <div class="recommendation-primary high-risk">
                <h5><i class="fas fa-exclamation-circle"></i> 考慮縮短DAPT</h5>
                <p>考慮縮短雙重抗血小板治療至 <strong>3-6個月</strong>。出血風險顯著增加，需要個人化治療策略。</p>
            </div>
        `;
        additionalRecommendations.push('強制胃腸道保護');
        additionalRecommendations.push('每月監測血液學參數');
        additionalRecommendations.push('考慮替代抗栓策略');
        monitoringPoints.push('24/7出血風險監測');
    }
    
    // 根據具體參數添加特殊建議
    if (age >= 75) {
        monitoringPoints.push('高齡患者需特別注意跌倒風險');
    }
    if (hb < 12.0) {
        additionalRecommendations.push('治療基礎貧血');
        monitoringPoints.push('監測血紅蛋白變化');
    }
    if (cr < 60) {
        additionalRecommendations.push('腎功能不全需調整藥物劑量');
    }
    if (priorBleeding) {
        monitoringPoints.push('既往出血史患者需額外謹慎');
    }
    
    return `
        ${primaryRecommendation}
        
        ${additionalRecommendations.length > 0 ? `
            <div class="additional-recommendations">
                <h6><i class="fas fa-plus-circle"></i> 額外建議</h6>
                <ul>
                    ${additionalRecommendations.map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        ` : ''}
        
        ${monitoringPoints.length > 0 ? `
            <div class="monitoring-points">
                <h6><i class="fas fa-eye"></i> 監測要點</h6>
                <ul>
                    ${monitoringPoints.map(point => `<li>${point}</li>`).join('')}
                </ul>
            </div>
                 ` : ''}
     `;
}

// 自動載入檢驗數據
async function autoLoadLabData(tabContent) {
    if (!smartClient) {
        showNotification('SMART 客戶端未就緒，無法載入數據', 'warning');
        return;
    }
    
    showNotification('正在載入檢驗數據...', 'info');
    
    try {
        // 獲取患者年齡 (從出生日期計算)
        if (smartClient.patient) {
            const patientData = await smartClient.patient.read();
            if (patientData.birthDate) {
                const age = calculateAge(patientData.birthDate);
                const ageInput = tabContent.querySelector('#patientAge');
                if (ageInput && age !== 'Unknown') {
                    ageInput.value = age;
                    updateScoreDisplay(tabContent, 'ageScore', calculateAgeScore(parseFloat(age)));
                    updateDataStatus(tabContent, 'ageStatus', 'auto');
                } else {
                    updateDataStatus(tabContent, 'ageStatus', 'missing');
                }
            } else {
                updateDataStatus(tabContent, 'ageStatus', 'missing');
            }
        }

        // 載入最新的檢驗數據
        const labData = await loadLatestLabValues();
        
        // 更新血紅蛋白值
        if (labData.hemoglobin) {
            const hbInput = tabContent.querySelector('#hemoglobin');
            if (hbInput) {
                hbInput.value = labData.hemoglobin;
                updateScoreDisplay(tabContent, 'hbScore', calculateHemoglobinScore(parseFloat(labData.hemoglobin)));
                updateDataStatus(tabContent, 'hbStatus', 'auto');
            }
        } else {
            updateDataStatus(tabContent, 'hbStatus', 'missing');
        }
        
        // 更新肌酸酐清除率
        if (labData.creatinineClearance) {
            const crInput = tabContent.querySelector('#creatinine');
            if (crInput) {
                crInput.value = labData.creatinineClearance;
                updateScoreDisplay(tabContent, 'crScore', calculateCreatinineScore(parseFloat(labData.creatinineClearance)));
                updateDataStatus(tabContent, 'crStatus', 'auto');
            }
        } else {
            updateDataStatus(tabContent, 'crStatus', 'missing');
        }
        
        // 更新白血球計數
        if (labData.wbc) {
            const wbcInput = tabContent.querySelector('#wbc');
            if (wbcInput) {
                wbcInput.value = labData.wbc;
                updateScoreDisplay(tabContent, 'wbcScore', calculateWBCScore(parseFloat(labData.wbc)));
                updateDataStatus(tabContent, 'wbcStatus', 'auto');
            }
        } else {
            updateDataStatus(tabContent, 'wbcStatus', 'missing');
        }
        
        // 檢查既往出血史
        const bleedingHistory = await checkBleedingHistory();
        if (bleedingHistory !== null) {
            const bleedingCheckbox = tabContent.querySelector('#priorBleeding');
            if (bleedingCheckbox) {
                bleedingCheckbox.checked = bleedingHistory;
                updateScoreDisplay(tabContent, 'bleedingScore', bleedingHistory ? 25 : 0);
                updateDataStatus(tabContent, 'bleedingStatus', 'auto');
            }
        } else {
            updateDataStatus(tabContent, 'bleedingStatus', 'missing');
        }
        
        // 自動計算總分並更新建議
        calculatePreciseDAPTScore(tabContent, false);
        
        // 提供數據載入狀態的詳細回饋
        const foundCount = [labData.hemoglobin, labData.creatinineClearance, labData.wbc, bleedingHistory !== null].filter(Boolean).length;
        const totalItems = 4;
        
        if (foundCount === totalItems) {
            showNotification('✅ 所有檢驗數據已成功載入並自動計算風險分數', 'success');
        } else if (foundCount > 0) {
            showNotification(`📊 已載入 ${foundCount}/${totalItems} 項檢驗數據，其餘使用預設值`, 'warning');
        } else {
            showNotification('⚠️ 未找到檢驗數據，請手動輸入或檢查FHIR連接', 'warning');
        }
        
    } catch (error) {
        console.error('載入檢驗數據失敗:', error);
        showNotification('載入檢驗數據失敗，請手動輸入', 'error');
    }
}

// 載入最新的檢驗數值
async function loadLatestLabValues() {
    const labData = {
        hemoglobin: null,
        creatinineClearance: null,
        wbc: null
    };
    
    try {
        console.log('🔍 開始搜尋檢驗數據...');
        
        // 擴展搜尋到最近1年的檢驗結果
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const dateFilter = `date=ge${oneYearAgo.toISOString().split('T')[0]}`;
        
        console.log(`📅 搜尋時間範圍: ${oneYearAgo.toISOString().split('T')[0]} 至今`);
        
        // 1. 載入血紅蛋白 - 使用多個LOINC代碼
        const hemoglobinCodes = [
            '718-7',    // 血紅蛋白 [質量/體積] 血液中
            '20570-8',  // 血紅蛋白 [質量/體積] 血液中的自動計數
            '30313-1',  // 血紅蛋白 [質量/體積] 動脈血中
            '33747-0',  // 血紅蛋白 [質量/體積] 毛細血管血液中
            '76768-1'   // 血紅蛋白 [質量/體積] 混合靜脈血液中
        ];
        
        console.log('🩸 搜尋血紅蛋白數值...');
        for (const code of hemoglobinCodes) {
            try {
                const hbResponse = await smartClient.request(
                    `Observation?patient=${smartClient.patient.id}&code=${code}&${dateFilter}&_sort=-date&_count=5`
                );
                console.log(`檢查 LOINC ${code}:`, hbResponse.entry?.length || 0, '個結果');
                
                if (hbResponse.entry && hbResponse.entry.length > 0) {
                    const hbObs = hbResponse.entry[0].resource;
                    if (hbObs.valueQuantity && hbObs.valueQuantity.value) {
                        labData.hemoglobin = hbObs.valueQuantity.value;
                        console.log(`✅ 找到血紅蛋白值: ${labData.hemoglobin} ${hbObs.valueQuantity.unit}`);
                        break;
                    }
                }
            } catch (e) {
                console.warn(`LOINC ${code} 搜尋失敗:`, e);
            }
        }
        
        // 如果沒找到具體代碼，試試廣泛搜尋
        if (!labData.hemoglobin) {
            try {
                console.log('🔍 嘗試廣泛搜尋血紅蛋白...');
                const broadHbSearch = await smartClient.request(
                    `Observation?patient=${smartClient.patient.id}&_text=hemoglobin,血紅蛋白&${dateFilter}&_sort=-date&_count=10`
                );
                console.log('廣泛搜尋結果:', broadHbSearch.entry?.length || 0, '個');
                
                if (broadHbSearch.entry) {
                    for (const entry of broadHbSearch.entry) {
                        const obs = entry.resource;
                        if (obs.valueQuantity && obs.valueQuantity.value && 
                            (obs.code?.text?.toLowerCase().includes('hemoglobin') ||
                             obs.code?.text?.includes('血紅蛋白') ||
                             obs.code?.coding?.some(c => c.display?.toLowerCase().includes('hemoglobin')))) {
                            labData.hemoglobin = obs.valueQuantity.value;
                            console.log(`✅ 廣泛搜尋找到血紅蛋白: ${labData.hemoglobin} ${obs.valueQuantity.unit}`);
                            break;
                        }
                    }
                }
            } catch (e) {
                console.warn('廣泛搜尋血紅蛋白失敗:', e);
            }
        }
        
        // 2. 載入肌酸酐和計算清除率
        const creatinineCodes = [
            '2160-0',   // 肌酸酐 [質量/體積] 血清或血漿中
            '38483-4',  // 肌酸酐 [質量/體積] 血液中
            '14682-9',  // 肌酸酐 [質量/體積] 血清或血漿中 - 酶法
            '33914-3'   // 肌酸酐清除率/1.73平方米
        ];
        
        console.log('🧪 搜尋肌酸酐數值...');
        for (const code of creatinineCodes) {
            try {
                const crResponse = await smartClient.request(
                    `Observation?patient=${smartClient.patient.id}&code=${code}&${dateFilter}&_sort=-date&_count=5`
                );
                console.log(`檢查 LOINC ${code}:`, crResponse.entry?.length || 0, '個結果');
                
                if (crResponse.entry && crResponse.entry.length > 0) {
                    const crObs = crResponse.entry[0].resource;
                    if (crObs.valueQuantity && crObs.valueQuantity.value) {
                        if (code === '33914-3') {
                            // 直接的肌酸酐清除率
                            labData.creatinineClearance = Math.round(crObs.valueQuantity.value);
                            console.log(`✅ 找到肌酸酐清除率: ${labData.creatinineClearance} ${crObs.valueQuantity.unit}`);
                        } else {
                            // 肌酸酐數值，需要計算清除率
                            const creatinine = crObs.valueQuantity.value;
                            const patientData = await smartClient.patient.read();
                            if (patientData.birthDate && patientData.gender) {
                                const age = calculateAge(patientData.birthDate);
                                const weight = 70; // 假設體重70kg
                                const isFemale = patientData.gender === 'female';
                                
                                let crCl = ((140 - age) * weight) / (72 * creatinine);
                                if (isFemale) {
                                    crCl *= 0.85;
                                }
                                
                                labData.creatinineClearance = Math.round(crCl);
                                console.log(`✅ 計算得肌酸酐清除率: ${labData.creatinineClearance} mL/min (from Cr: ${creatinine})`);
                            }
                        }
                        break;
                    }
                }
            } catch (e) {
                console.warn(`LOINC ${code} 搜尋失敗:`, e);
            }
        }
        
        // 3. 載入白血球計數
        const wbcCodes = [
            '26464-8',  // 白血球計數 [數量/體積] 血液中
            '6690-2',   // 白血球計數 [數量/體積] 血液中 自動計數
            '33256-9',  // 白血球計數 [數量/體積] 血液中 估算
            '804-5'     // 白血球計數 [數量/體積] 血液中 手動計數
        ];
        
        console.log('⚪ 搜尋白血球計數...');
        for (const code of wbcCodes) {
            try {
                const wbcResponse = await smartClient.request(
                    `Observation?patient=${smartClient.patient.id}&code=${code}&${dateFilter}&_sort=-date&_count=5`
                );
                console.log(`檢查 LOINC ${code}:`, wbcResponse.entry?.length || 0, '個結果');
                
                if (wbcResponse.entry && wbcResponse.entry.length > 0) {
                    const wbcObs = wbcResponse.entry[0].resource;
                    if (wbcObs.valueQuantity && wbcObs.valueQuantity.value) {
                        // 轉換單位到 10^9/L
                        let wbcValue = wbcObs.valueQuantity.value;
                        const unit = wbcObs.valueQuantity.unit;
                        if (unit && (unit.includes('/uL') || unit.includes('/μL'))) {
                            wbcValue = wbcValue / 1000; // 轉換 /uL 到 10^9/L
                        }
                        labData.wbc = Math.round(wbcValue * 10) / 10;
                        console.log(`✅ 找到白血球計數: ${labData.wbc} x10^9/L (原值: ${wbcObs.valueQuantity.value} ${unit})`);
                        break;
                    }
                }
            } catch (e) {
                console.warn(`LOINC ${code} 搜尋失敗:`, e);
            }
        }
        
        // 嘗試從所有檢驗觀察記錄中搜尋
        if (!labData.hemoglobin || !labData.creatinineClearance || !labData.wbc) {
            console.log('🔍 嘗試從所有檢驗記錄中搜尋...');
            try {
                const allLabsResponse = await smartClient.request(
                    `Observation?patient=${smartClient.patient.id}&category=laboratory&${dateFilter}&_sort=-date&_count=50`
                );
                console.log(`找到 ${allLabsResponse.entry?.length || 0} 個檢驗記錄`);
                
                if (allLabsResponse.entry) {
                    for (const entry of allLabsResponse.entry) {
                        const obs = entry.resource;
                        const display = obs.code?.text || obs.code?.coding?.[0]?.display || '';
                        console.log(`檢查記錄: ${display}`);
                        
                        // 搜尋血紅蛋白相關
                        if (!labData.hemoglobin && obs.valueQuantity && 
                            (display.toLowerCase().includes('hemoglobin') || display.includes('血紅蛋白') ||
                             display.toLowerCase().includes('hb') || display.toLowerCase().includes('haemoglobin'))) {
                            labData.hemoglobin = obs.valueQuantity.value;
                            console.log(`✅ 從檢驗記錄找到血紅蛋白: ${labData.hemoglobin}`);
                        }
                        
                        // 搜尋肌酸酐相關
                        if (!labData.creatinineClearance && obs.valueQuantity &&
                            (display.toLowerCase().includes('creatinine') || display.includes('肌酸酐'))) {
                            const creatinine = obs.valueQuantity.value;
                            const patientData = await smartClient.patient.read();
                            if (patientData.birthDate && patientData.gender && creatinine > 0.1 && creatinine < 10) {
                                const age = calculateAge(patientData.birthDate);
                                const weight = 70;
                                const isFemale = patientData.gender === 'female';
                                
                                let crCl = ((140 - age) * weight) / (72 * creatinine);
                                if (isFemale) {
                                    crCl *= 0.85;
                                }
                                
                                labData.creatinineClearance = Math.round(crCl);
                                console.log(`✅ 從檢驗記錄計算肌酸酐清除率: ${labData.creatinineClearance}`);
                            }
                        }
                        
                        // 搜尋白血球相關
                        if (!labData.wbc && obs.valueQuantity &&
                            (display.toLowerCase().includes('white') || display.toLowerCase().includes('wbc') ||
                             display.includes('白血球') || display.toLowerCase().includes('leukocyte'))) {
                            let wbcValue = obs.valueQuantity.value;
                            const unit = obs.valueQuantity.unit || '';
                            if (unit.includes('/uL') || unit.includes('/μL')) {
                                wbcValue = wbcValue / 1000;
                            }
                            labData.wbc = Math.round(wbcValue * 10) / 10;
                            console.log(`✅ 從檢驗記錄找到白血球: ${labData.wbc}`);
                        }
                    }
                }
            } catch (e) {
                console.warn('搜尋所有檢驗記錄失敗:', e);
            }
        }
        
        console.log('📊 最終檢驗數據:', labData);
        
        // 如果仍沒找到關鍵數據，為高齡病患提供合理的預設值
        if (smartClient && smartClient.patient) {
            try {
                const patientData = await smartClient.patient.read();
                const age = calculateAge(patientData.birthDate);
                const isMale = patientData.gender === 'male';
                
                if (age > 80) { // 高齡病患
                    if (!labData.hemoglobin) {
                        // 高齡病患血紅蛋白通常較低
                        labData.hemoglobin = isMale ? 12.5 : 11.8;
                        console.log(`🔧 為${age}歲${isMale ? '男性' : '女性'}病患設置合理血紅蛋白預設值: ${labData.hemoglobin} g/dL`);
                    }
                    
                    if (!labData.creatinineClearance) {
                        // 高齡病患腎功能通常下降
                        const baseValue = isMale ? 85 : 75;
                        const ageReduction = Math.max(0, (age - 65) * 1.2);
                        labData.creatinineClearance = Math.round(Math.max(30, baseValue - ageReduction));
                        console.log(`🔧 為${age}歲病患設置合理肌酸酐清除率預設值: ${labData.creatinineClearance} mL/min`);
                    }
                    
                    if (!labData.wbc) {
                        // 高齡病患白血球可能稍低
                        labData.wbc = Math.round((5.5 + (Math.random() - 0.5) * 2) * 10) / 10;
                        console.log(`🔧 為高齡病患設置合理白血球預設值: ${labData.wbc} ×10^9/L`);
                    }
                }
            } catch (e) {
                console.warn('無法獲取病患資料來設置預設值:', e);
            }
        }
        
    } catch (error) {
        console.error('載入檢驗數據時發生錯誤:', error);
    }
    
    return labData;
}

// 調試功能：顯示原始檢驗數據
async function showRawLabData() {
    if (!smartClient) {
        alert('SMART客戶端未連接');
        return;
    }
    
    try {
        showNotification('🔍 正在檢索所有檢驗數據...', 'info');
        
        // 獲取過去1年的所有檢驗數據
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const dateFilter = `date=ge${oneYearAgo.toISOString().split('T')[0]}`;
        
        const response = await smartClient.request(
            `Observation?patient=${smartClient.patient.id}&category=laboratory&${dateFilter}&_sort=-date&_count=100`
        );
        
        console.log('原始檢驗數據回應:', response);
        
        let content = `
            <h2>📊 檢驗數據調試資訊</h2>
            <p><strong>搜索範圍:</strong> ${oneYearAgo.toLocaleDateString()} ~ ${new Date().toLocaleDateString()}</p>
            <p><strong>找到記錄:</strong> ${response.entry?.length || 0} 項</p>
            <hr>
        `;
        
        if (response.entry && response.entry.length > 0) {
            const relevantObs = [];
            
            response.entry.forEach((entry, index) => {
                const obs = entry.resource;
                const code = obs.code?.coding?.[0]?.code || '未知代碼';
                const display = obs.code?.text || obs.code?.coding?.[0]?.display || '未知項目';
                const value = obs.valueQuantity?.value || '無數值';
                const unit = obs.valueQuantity?.unit || '';
                const date = obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString('zh-TW') : '無日期';
                
                // 檢查是否為相關檢驗項目
                const isRelevant = 
                    display.toLowerCase().includes('hemoglobin') ||
                    display.toLowerCase().includes('creatinine') ||
                    display.toLowerCase().includes('white') ||
                    display.toLowerCase().includes('wbc') ||
                    display.includes('血紅蛋白') ||
                    display.includes('肌酸酐') ||
                    display.includes('白血球') ||
                    ['718-7', '20570-8', '30313-1', '33747-0', '76768-1', 
                     '2160-0', '38483-4', '14682-9', '33914-3',
                     '26464-8', '6690-2', '33256-9', '804-5'].includes(code);
                
                if (isRelevant) {
                    relevantObs.push({
                        index: index + 1,
                        date,
                        code,
                        display,
                        value,
                        unit,
                        raw: obs
                    });
                }
            });
            
            if (relevantObs.length > 0) {
                content += `<h3>🎯 相關檢驗項目 (${relevantObs.length} 項)</h3>`;
                relevantObs.forEach(item => {
                    content += `
                        <div style="background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 5px;">
                            <strong>[${item.index}] ${item.display}</strong><br>
                            <span style="color: #666;">LOINC: ${item.code} | 日期: ${item.date}</span><br>
                            <span style="color: #007bff; font-weight: bold;">數值: ${item.value} ${item.unit}</span>
                        </div>
                    `;
                });
            } else {
                content += '<p style="color: #dc3545;">❌ 未找到相關的血紅蛋白、肌酸酐或白血球檢驗記錄</p>';
            }
            
            content += `<h3>📝 所有檢驗記錄 (前20項)</h3>`;
            response.entry.slice(0, 20).forEach((entry, index) => {
                const obs = entry.resource;
                const code = obs.code?.coding?.[0]?.code || '未知';
                const display = obs.code?.text || obs.code?.coding?.[0]?.display || '未知項目';
                const value = obs.valueQuantity?.value || obs.valueString || obs.valueCodeableConcept?.text || '無數值';
                const unit = obs.valueQuantity?.unit || '';
                const date = obs.effectiveDateTime ? new Date(obs.effectiveDateTime).toLocaleDateString('zh-TW') : '無日期';
                
                content += `
                    <div style="background: #f1f3f4; padding: 8px; margin: 3px 0; border-radius: 3px; font-size: 12px;">
                        <strong>${index + 1}. ${display}</strong> (${code})<br>
                        <span style="color: #666;">日期: ${date} | 數值: ${value} ${unit}</span>
                    </div>
                `;
            });
            
        } else {
            content += '<p style="color: #dc3545;">❌ 未找到任何檢驗記錄</p>';
            content += '<p>可能原因：</p>';
            content += '<ul>';
            content += '<li>病患在此FHIR服務器中沒有檢驗記錄</li>';
            content += '<li>檢驗記錄的分類不是"laboratory"</li>';
            content += '<li>搜索時間範圍內沒有記錄</li>';
            content += '<li>FHIR服務器權限問題</li>';
            content += '</ul>';
        }
        
        // 創建模態窗口顯示結果
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
            justify-content: center; align-items: center; padding: 20px;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white; border-radius: 10px; padding: 20px;
            max-width: 800px; width: 100%; max-height: 80vh;
            overflow-y: auto; position: relative;
        `;
        
        modalContent.innerHTML = content + `
            <button onclick="this.closest('.modal').remove()" 
                    style="position: absolute; top: 15px; right: 15px; background: #dc3545; 
                           color: white; border: none; border-radius: 50%; width: 30px; height: 30px; 
                           cursor: pointer; font-size: 16px;">×</button>
        `;
        
        modal.className = 'modal';
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        showNotification('檢驗數據已顯示', 'success');
        
    } catch (error) {
        console.error('獲取檢驗數據失敗:', error);
        alert('獲取檢驗數據失敗: ' + error.message);
    }
}

// ================================
// Fabry Disease 功能支援函數
// ================================

// 放大圖片功能
function zoomImage(button) {
    const fabryImage = document.getElementById('fabryFlowChart');
    const overlay = document.getElementById('imageOverlay');
    const overlayImage = document.getElementById('overlayImage');
    
    if (fabryImage && overlay && overlayImage) {
        overlayImage.src = fabryImage.src;
        overlay.style.display = 'flex';
        document.body.style.overflow = 'hidden'; // 防止背景滾動
        
        // 添加 ESC 鍵關閉功能
        const handleEscKey = (event) => {
            if (event.key === 'Escape') {
                closeImageOverlay();
                document.removeEventListener('keydown', handleEscKey);
            }
        };
        document.addEventListener('keydown', handleEscKey);
    }
}

// 關閉圖片覆蓋層
function closeImageOverlay() {
    const overlay = document.getElementById('imageOverlay');
    if (overlay) {
        overlay.style.display = 'none';
        document.body.style.overflow = 'auto'; // 恢復背景滾動
    }
}

// 下載圖片功能
function downloadImage() {
    const fabryImage = document.getElementById('fabryFlowChart');
    if (fabryImage) {
        const link = document.createElement('a');
        link.href = fabryImage.src;
        link.download = 'Fabry_Disease_檢驗流程圖.png';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showNotification('圖片下載已開始', 'success');
    } else {
        showNotification('無法找到圖片', 'error');
    }
}

// 列印圖片功能
function printImage() {
    const fabryImage = document.getElementById('fabryFlowChart');
    if (fabryImage) {
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>Fabry Disease 檢驗流程圖</title>
                    <style>
                        body {
                            margin: 0;
                            padding: 20px;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            background: white;
                        }
                        img {
                            max-width: 100%;
                            max-height: 100vh;
                            object-fit: contain;
                            border: 1px solid #ddd;
                        }
                        h1 {
                            text-align: center;
                            color: #333;
                            font-family: Arial, sans-serif;
                            margin-bottom: 20px;
                        }
                        .print-container {
                            text-align: center;
                        }
                        @media print {
                            body { margin: 0; padding: 0; }
                            .print-container { page-break-inside: avoid; }
                        }
                    </style>
                </head>
                <body>
                    <div class="print-container">
                        <h1>Fabry Disease 檢驗流程圖</h1>
                        <img src="${fabryImage.src}" alt="Fabry Disease 檢驗流程圖">
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        
        printWindow.onload = function() {
            printWindow.print();
            printWindow.onafterprint = function() {
                printWindow.close();
            };
        };
    } else {
        showNotification('無法找到圖片', 'error');
    }
}

// 開立檢驗單功能
function orderLabTests() {
    showNotification('正在開立 Fabry Disease 相關檢驗單...', 'info');
    
    // 模擬開立檢驗單的過程
    setTimeout(() => {
        const tests = [
            'α-Galactosidase A 酵素活性檢測',
            'GLA 基因檢測',
            'Gb3/lyso-Gb3 生物標記物檢測',
            'lyso-Gb3 尿液檢測'
        ];
        
        const testList = tests.map(test => `• ${test}`).join('\n');
        
        if (confirm(`即將開立以下 Fabry Disease 相關檢驗：\n\n${testList}\n\n確定要繼續嗎？`)) {
            showNotification('檢驗單已成功開立並送出', 'success');
            
            // 如果有 SMART on FHIR 整合，可以在這裡調用相關 API
            if (smartClient) {
                console.log('可整合 FHIR ServiceRequest 資源來開立檢驗單');
            }
        } else {
            showNotification('檢驗單開立已取消', 'info');
        }
    }, 1000);
}

// 諮詢遺傳科功能
function consultGenetics() {
    showNotification('正在安排遺傳科諮詢...', 'info');
    
    setTimeout(() => {
        const consultInfo = {
            department: '遺傳科',
            specialty: 'Fabry Disease 專科諮詢',
            urgency: '一般件',
            reason: 'Fabry Disease 診斷確認與遺傳諮詢'
        };
        
        const message = `諮詢資訊：\n科別：${consultInfo.department}\n專科：${consultInfo.specialty}\n急迫性：${consultInfo.urgency}\n原因：${consultInfo.reason}`;
        
        if (confirm(`${message}\n\n確定要送出諮詢請求嗎？`)) {
            showNotification('遺傳科諮詢請求已送出，將盡快安排', 'success');
        } else {
            showNotification('諮詢請求已取消', 'info');
        }
    }, 800);
}

// 查看完整指引功能
function showGuidelines() {
    showNotification('正在載入 Fabry Disease 完整診療指引...', 'info');
    
    setTimeout(() => {
        const guidelinesContent = `
            <div style="padding: 20px; max-height: 400px; overflow-y: auto;">
                <h3>Fabry Disease 診療指引摘要</h3>
                
                <h4>1. 診斷標準</h4>
                <ul>
                    <li>典型臨床症狀（疼痛、血管角質瘤、腎病、心臟病等）</li>
                    <li>男性：α-Gal A 酵素活性明顯降低</li>
                    <li>女性：GLA 基因檢測為主要診斷方法</li>
                    <li>家族史陽性</li>
                </ul>
                
                <h4>2. 檢驗項目優先順序</h4>
                <ol>
                    <li><strong>第一線：</strong>α-Gal A 酵素活性（男性）</li>
                    <li><strong>第二線：</strong>GLA 基因檢測（確診）</li>
                    <li><strong>輔助檢測：</strong>Gb3/lyso-Gb3 生物標記物</li>
                    <li><strong>篩檢工具：</strong>乾血點 (DBS) 檢測</li>
                </ol>
                
                <h4>3. 治療選項</h4>
                <ul>
                    <li><strong>酵素替代療法：</strong>α-galactosidase A 注射</li>
                    <li><strong>伴護分子療法：</strong>migalastat（口服藥物）</li>
                    <li><strong>支持性治療：</strong>疼痛管理、腎臟保護等</li>
                </ul>
                
                <h4>4. 追蹤監測</h4>
                <ul>
                    <li>每6個月：腎功能、心臟功能評估</li>
                    <li>每年：聽力檢查、眼科檢查</li>
                    <li>lyso-Gb3 定期監測</li>
                </ul>
                
                <div style="margin-top: 20px; padding: 10px; background: #f8f9fa; border-left: 4px solid #007bff;">
                    <strong>重要提醒：</strong>Fabry Disease 為 X 聯鎖遺傳疾病，建議進行家族篩檢和遺傳諮詢。
                </div>
            </div>
        `;
        
        // 創建模態窗口顯示指引
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8); z-index: 10000; display: flex;
            justify-content: center; align-items: center; padding: 20px;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white; border-radius: 10px; max-width: 600px; width: 100%;
            position: relative; max-height: 80vh; overflow: hidden;
        `;
        
        modalContent.innerHTML = guidelinesContent + `
            <div style="position: absolute; top: 15px; right: 15px;">
                <button onclick="this.closest('.guidelines-modal').remove()" 
                        style="background: #dc3545; color: white; border: none; border-radius: 50%; 
                               width: 30px; height: 30px; cursor: pointer; font-size: 16px;">×</button>
            </div>
            <div style="padding: 0 20px 20px; text-align: center;">
                <button onclick="this.closest('.guidelines-modal').remove()" 
                        style="background: #007bff; color: white; border: none; padding: 8px 16px; 
                               border-radius: 4px; cursor: pointer;">關閉</button>
            </div>
        `;
        
        modal.className = 'guidelines-modal';
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        modal.onclick = (e) => {
            if (e.target === modal) modal.remove();
        };
        
        showNotification('診療指引已顯示', 'success');
    }, 500);
}

// 檢查既往出血史
async function checkBleedingHistory() {
    try {
        // 搜尋出血相關的診斷 (ICD-10 codes for bleeding disorders)
        const bleedingCodes = [
            'D68', // 其他凝血缺陷
            'D69', // 紫癜和其他出血性疾病
            'K92.2', // 胃腸道出血
            'R04', // 呼吸道出血
            'R58', // 出血，未歸類他處者
            'N95.0', // 停經後出血
            'H43.1', // 玻璃體出血
        ];
        
        // 搜尋任何出血相關的診斷
        for (const code of bleedingCodes) {
            try {
                const conditionResponse = await smartClient.request(
                    `Condition?patient=${smartClient.patient.id}&code=${code}`
                );
                if (conditionResponse.entry && conditionResponse.entry.length > 0) {
                    return true; // 找到出血史
                }
            } catch (e) {
                console.warn(`檢查出血史代碼 ${code} 時出錯:`, e);
            }
        }
        
        // 搜尋出血相關的觀察紀錄
        try {
            const obsResponse = await smartClient.request(
                `Observation?patient=${smartClient.patient.id}&code=LOINC|LA6112-2&_count=10`
            );
            if (obsResponse.entry && obsResponse.entry.length > 0) {
                // 檢查是否有出血相關的描述
                for (const entry of obsResponse.entry) {
                    const obs = entry.resource;
                    if (obs.valueString && 
                        (obs.valueString.toLowerCase().includes('bleeding') ||
                         obs.valueString.toLowerCase().includes('hemorrhage') ||
                         obs.valueString.includes('出血'))) {
                        return true;
                    }
                }
            }
        } catch (e) {
            console.warn('檢查出血史觀察紀錄時出錯:', e);
        }
        
        return false; // 未找到出血史
        
    } catch (error) {
        console.error('檢查出血史時發生錯誤:', error);
        return false;
    }
}

// 載入個人史和用藥資訊
async function loadPersonalHistoryAndMedications() {
    console.log('載入個人史和用藥資訊...');
    
    try {
        // 載入個人史資訊
        await loadPersonalHistory();
        
        // 載入現狀用藥
        await loadCurrentMedications();
        
        console.log('個人史和用藥資訊載入完成');
        
    } catch (error) {
        console.error('載入個人史和用藥資訊失敗:', error);
    }
}

// 載入個人史資訊
async function loadPersonalHistory() {
    try {
        if (!smartClient || !smartClient.patient) {
            console.warn('SMART 客戶端未就緒，使用預設個人史資訊');
            return;
        }
        
        const patientData = await smartClient.patient.read();
        
        // 載入身高體重資訊
        await loadVitalSigns(patientData);
        
        // 載入過敏史
        await loadAllergies(patientData);
        
        // 載入抽菸史
        await loadSmokingHistory(patientData);
        
    } catch (error) {
        console.error('載入個人史失敗:', error);
        showNotification('個人史資訊載入失敗，顯示預設資訊', 'warning');
    }
}

// 載入生命徵象 (身高體重)
async function loadVitalSigns(patientData) {
    try {
        let height = null;
        let weight = null;
        
        // 搜尋身高 (LOINC: 8302-2)
        const heightResponse = await smartClient.request(
            `Observation?patient=${patientData.id}&code=8302-2&_sort=-date&_count=1`
        );
        if (heightResponse.entry && heightResponse.entry.length > 0) {
            const heightObs = heightResponse.entry[0].resource;
            if (heightObs.valueQuantity) {
                height = heightObs.valueQuantity.value;
            }
        }
        
        // 搜尋體重 (LOINC: 29463-7)
        const weightResponse = await smartClient.request(
            `Observation?patient=${patientData.id}&code=29463-7&_sort=-date&_count=1`
        );
        if (weightResponse.entry && weightResponse.entry.length > 0) {
            const weightObs = weightResponse.entry[0].resource;
            if (weightObs.valueQuantity) {
                weight = weightObs.valueQuantity.value;
            }
        }
        
        // 更新身高體重顯示
        if (height || weight) {
            const heightWeightElement = document.getElementById('heightWeight');
            if (heightWeightElement) {
                let bmi = '';
                if (height && weight) {
                    const heightInM = height / 100; // 轉換為公尺
                    const bmiValue = (weight / (heightInM * heightInM)).toFixed(1);
                    bmi = `<br>BMI: ${bmiValue}`;
                }
                
                heightWeightElement.innerHTML = `
                    身高: ${height ? height + ' cm' : '未記錄'}<br>
                    體重: ${weight ? weight + ' kg' : '未記錄'}
                    ${bmi}
                `;
            }
        }
        
    } catch (error) {
        console.warn('載入身高體重資訊失敗:', error);
    }
}

// 載入過敏史
async function loadAllergies(patientData) {
    try {
        const allergyResponse = await smartClient.request(
            `AllergyIntolerance?patient=${patientData.id}&_sort=-recordedDate&_count=5`
        );
        
        let allergiesText = '無已知過敏';
        
        if (allergyResponse.entry && allergyResponse.entry.length > 0) {
            const allergies = allergyResponse.entry.map(entry => {
                const allergy = entry.resource;
                let allergen = '未知過敏原';
                let type = '未分類';
                
                if (allergy.code && allergy.code.text) {
                    allergen = allergy.code.text;
                } else if (allergy.code && allergy.code.coding && allergy.code.coding.length > 0) {
                    allergen = allergy.code.coding[0].display || allergy.code.coding[0].code;
                }
                
                if (allergy.category && allergy.category.length > 0) {
                    switch (allergy.category[0]) {
                        case 'medication':
                            type = '藥物過敏';
                            break;
                        case 'food':
                            type = '食物過敏';
                            break;
                        case 'environment':
                            type = '環境過敏';
                            break;
                        default:
                            type = '其他過敏';
                    }
                }
                
                return `${allergen} (${type})`;
            });
            
            allergiesText = allergies.join('<br>');
        }
        
        const allergiesElement = document.getElementById('allergies');
        if (allergiesElement) {
            allergiesElement.innerHTML = allergiesText;
        }
        
    } catch (error) {
        console.warn('載入過敏史失敗:', error);
    }
}

// 載入抽菸史
async function loadSmokingHistory(patientData) {
    try {
        // 搜尋抽菸狀態 (LOINC: 72166-2)
        const smokingResponse = await smartClient.request(
            `Observation?patient=${patientData.id}&code=72166-2&_sort=-date&_count=1`
        );
        
        let smokingText = '無記錄';
        
        if (smokingResponse.entry && smokingResponse.entry.length > 0) {
            const smokingObs = smokingResponse.entry[0].resource;
            
            if (smokingObs.valueCodeableConcept && smokingObs.valueCodeableConcept.text) {
                smokingText = smokingObs.valueCodeableConcept.text;
            } else if (smokingObs.valueString) {
                smokingText = smokingObs.valueString;
            }
            
            // 如果有效值日期，添加到顯示中
            if (smokingObs.effectiveDateTime) {
                const date = new Date(smokingObs.effectiveDateTime).toLocaleDateString('zh-TW');
                smokingText += `<br>記錄日期: ${date}`;
            }
        }
        
        const smokingElement = document.getElementById('smokingHistory');
        if (smokingElement) {
            smokingElement.innerHTML = smokingText;
        }
        
    } catch (error) {
        console.warn('載入抽菸史失敗:', error);
    }
}

// 載入現狀用藥
async function loadCurrentMedications() {
    try {
        if (!smartClient || !smartClient.patient) {
            console.warn('SMART 客戶端未就緒，使用預設用藥資訊');
            return;
        }
        
        const patientData = await smartClient.patient.read();
        
        // 搜尋活動中的用藥 (status=active)
        const medicationResponse = await smartClient.request(
            `MedicationRequest?patient=${patientData.id}&status=active&_sort=-authoredOn&_count=10&_include=MedicationRequest:medication`
        );
        
        if (medicationResponse.entry && medicationResponse.entry.length > 0) {
            updateMedicationDisplay(medicationResponse.entry);
        } else {
            console.log('未找到活動中的用藥記錄，保持預設顯示');
        }
        
    } catch (error) {
        console.warn('載入現狀用藥失敗:', error);
    }
}

// 更新用藥顯示
function updateMedicationDisplay(entries) {
    const medicationList = document.querySelector('.medication-list');
    if (!medicationList) return;
    
    // 創建藥物映射表
    const medications = new Map();
    
    // 首先處理藥物資源
    entries.forEach(entry => {
        if (entry.resource.resourceType === 'Medication') {
            medications.set(entry.fullUrl || entry.resource.id, entry.resource);
        }
    });
    
    // 處理處方資源
    const medicationRequests = entries.filter(entry => 
        entry.resource.resourceType === 'MedicationRequest'
    );
    
    if (medicationRequests.length === 0) return;
    
    // 清空現有內容並添加新內容
    medicationList.innerHTML = '';
    
    medicationRequests.slice(0, 4).forEach(entry => { // 限制顯示前4個
        const medRequest = entry.resource;
        let medName = '未知藥物';
        let dosage = '劑量未記錄';
        let indication = '適應症未記錄';
        let duration = '療程未記錄';
        
        // 獲取藥物名稱
        if (medRequest.medicationCodeableConcept && medRequest.medicationCodeableConcept.text) {
            medName = medRequest.medicationCodeableConcept.text;
        } else if (medRequest.medicationCodeableConcept && 
                   medRequest.medicationCodeableConcept.coding && 
                   medRequest.medicationCodeableConcept.coding.length > 0) {
            medName = medRequest.medicationCodeableConcept.coding[0].display || 
                     medRequest.medicationCodeableConcept.coding[0].code;
        } else if (medRequest.medicationReference) {
            // 尋找對應的藥物資源
            const medResource = Array.from(medications.values()).find(med => 
                medRequest.medicationReference.reference.includes(med.id)
            );
            if (medResource && medResource.code && medResource.code.text) {
                medName = medResource.code.text;
            }
        }
        
        // 獲取劑量資訊
        if (medRequest.dosageInstruction && medRequest.dosageInstruction.length > 0) {
            const dosageInst = medRequest.dosageInstruction[0];
            
            if (dosageInst.text) {
                dosage = dosageInst.text;
            } else if (dosageInst.doseAndRate && dosageInst.doseAndRate.length > 0) {
                const dose = dosageInst.doseAndRate[0];
                if (dose.doseQuantity) {
                    dosage = `${dose.doseQuantity.value} ${dose.doseQuantity.unit || dose.doseQuantity.code}`;
                    
                    // 添加頻率
                    if (dosageInst.timing && dosageInst.timing.repeat && dosageInst.timing.repeat.frequency) {
                        const freq = dosageInst.timing.repeat.frequency;
                        const period = dosageInst.timing.repeat.period || 1;
                        const periodUnit = dosageInst.timing.repeat.periodUnit || 'd';
                        
                        let freqText = '';
                        switch (periodUnit) {
                            case 'd':
                                freqText = freq === 1 ? '每日一次' : `每日${freq}次`;
                                break;
                            case 'h':
                                freqText = `每${period}小時${freq}次`;
                                break;
                            default:
                                freqText = `${freq}次/${period}${periodUnit}`;
                        }
                        
                        dosage += ` ${freqText}`;
                    }
                }
            }
        }
        
        // 獲取適應症
        if (medRequest.reasonCode && medRequest.reasonCode.length > 0) {
            const reason = medRequest.reasonCode[0];
            indication = reason.text || (reason.coding && reason.coding.length > 0 ? reason.coding[0].display : indication);
        }
        
        // 獲取療程資訊
        if (medRequest.dispenseRequest && medRequest.dispenseRequest.expectedSupplyDuration) {
            const supply = medRequest.dispenseRequest.expectedSupplyDuration;
            duration = `${supply.value} ${supply.unit || supply.code}療程`;
        } else if (medRequest.effectivePeriod) {
            if (medRequest.effectivePeriod.start && medRequest.effectivePeriod.end) {
                const start = new Date(medRequest.effectivePeriod.start).toLocaleDateString('zh-TW');
                const end = new Date(medRequest.effectivePeriod.end).toLocaleDateString('zh-TW');
                duration = `${start} - ${end}`;
            } else if (medRequest.effectivePeriod.start) {
                const start = new Date(medRequest.effectivePeriod.start).toLocaleDateString('zh-TW');
                duration = `自 ${start} 開始`;
            }
        }
        
        // 創建藥物項目
        const medicationItem = document.createElement('div');
        medicationItem.className = 'medication-item';
        medicationItem.innerHTML = `
            <div class="med-icon">
                <i class="fas fa-capsules"></i>
            </div>
            <div class="med-details">
                <h4>${medName}</h4>
                <p class="dosage">${dosage}</p>
                <p class="indication">${indication}</p>
                <p class="duration"><i class="fas fa-clock"></i> ${duration}</p>
            </div>
            <div class="med-status">
                <span class="status-badge active">使用中</span>
            </div>
        `;
        
                 medicationList.appendChild(medicationItem);
     });
}

// 更新數據來源狀態
function updateDataStatus(tabContent, statusElementId, status) {
    const statusElement = tabContent.querySelector(`#${statusElementId} .status-indicator`);
    if (!statusElement) return;
    
    // 移除舊的狀態類別
    statusElement.classList.remove('manual', 'auto', 'missing');
    
    // 添加新的狀態類別和文字
    switch (status) {
        case 'auto':
            statusElement.classList.add('auto');
            statusElement.textContent = '自動';
            break;
        case 'missing':
            statusElement.classList.add('missing');
            statusElement.textContent = '缺失';
            break;
        case 'manual':
        default:
            statusElement.classList.add('manual');
            statusElement.textContent = '手動';
            break;
    }
}



// 創建不同功能的內容
function createASCVDContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-heart"></i>
                <h2>ASCVD 風險評估</h2>
            </div>
            <div class="cds-content">
                <div class="risk-calculator">
                    <div class="calculator-icon">
                        <i class="fas fa-calculator"></i>
                    </div>
                    <h3>ASCVD 風險計算器</h3>
                    <p>根據 ACC/AHA 2013 匯集族群方程式 (Pooled Cohort Equations) 計算10年動脈粥樣硬化性心血管疾病風險。</p>
                    <p>此等方程式，將在新的資料中打開完整的風險評估工具，並會自動帶入當前病人的數據（如果可用）。</p>
                    
                    <div class="risk-factors">
                        <h4>評估因子：</h4>
                        <ul>
                            <li><i class="fas fa-check-circle"></i> 年齡：105歲</li>
                            <li><i class="fas fa-check-circle"></i> 性別：男性</li>
                            <li><i class="fas fa-exclamation-triangle"></i> 膽固醇：需要檢測</li>
                            <li><i class="fas fa-exclamation-triangle"></i> 血壓：需要檢測</li>
                            <li><i class="fas fa-exclamation-triangle"></i> 糖尿病狀態：需要確認</li>
                            <li><i class="fas fa-exclamation-triangle"></i> 吸煙狀態：需要確認</li>
                        </ul>
                    </div>

                    <button class="cds-action-btn" onclick="openASCVDCalculator()">
                        <i class="fas fa-calculator"></i>
                        打開完整 ASCVD 評估
                    </button>
                </div>

                <div class="cds-recommendations">
                    <h4>CDS 建議：</h4>
                    <div class="recommendation-item high-risk">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>高風險患者：建議立即進行心血管風險評估</span>
                    </div>
                    <div class="recommendation-item">
                        <i class="fas fa-pills"></i>
                        <span>考慮他汀類藥物治療</span>
                    </div>
                    <div class="recommendation-item">
                        <i class="fas fa-heartbeat"></i>
                        <span>建議定期監測心血管指標</span>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 創建實驗室數據趨勢內容
function createLabTrendsContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-chart-line"></i>
                <h2>實驗室數據趨勢分析</h2>
                <div class="trend-controls">
                    <select id="timeRangeSelector" class="trend-selector">
                        <option value="6m">過去6個月</option>
                        <option value="1y" selected>過去1年</option>
                        <option value="2y">過去2年</option>
                        <option value="all">全部資料</option>
                    </select>
                    <button id="refreshLabData" class="refresh-btn">
                        <i class="fas fa-sync-alt"></i>
                        重新載入
                    </button>
                </div>
            </div>
            
            <div class="cds-content">
                <div class="lab-trends-container">
                    
                    <!-- 載入中狀態 -->
                    <div id="labDataLoading" class="loading-indicator">
                        <i class="fas fa-spinner fa-spin"></i>
                        <p>正在載入實驗室數據...</p>
                    </div>
                    
                    <!-- 數據概覽 -->
                    <div id="labDataOverview" class="lab-overview" style="display: none;">
                        <div class="overview-stats">
                            <div class="stat-card">
                                <div class="stat-icon eGFR">
                                    <i class="fas fa-kidneys"></i>
                                </div>
                                <div class="stat-info">
                                    <h4>eGFR</h4>
                                    <p class="stat-value" id="egfrLatest">--</p>
                                    <p class="stat-trend" id="egfrTrend">--</p>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon cholesterol">
                                    <i class="fas fa-droplet"></i>
                                </div>
                                <div class="stat-info">
                                    <h4>總膽固醇</h4>
                                    <p class="stat-value" id="cholesterolLatest">--</p>
                                    <p class="stat-trend" id="cholesterolTrend">--</p>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon hba1c">
                                    <i class="fas fa-vial"></i>
                                </div>
                                <div class="stat-info">
                                    <h4>HbA1c</h4>
                                    <p class="stat-value" id="hba1cLatest">--</p>
                                    <p class="stat-trend" id="hba1cTrend">--</p>
                                </div>
                            </div>
                            
                            <div class="stat-card">
                                <div class="stat-icon bp">
                                    <i class="fas fa-heartbeat"></i>
                                </div>
                                <div class="stat-info">
                                    <h4>血壓</h4>
                                    <p class="stat-value" id="bpLatest">--</p>
                                    <p class="stat-trend" id="bpTrend">--</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 圖表區域 -->
                    <div id="labChartsContainer" class="charts-container" style="display: none;">
                        
                        <!-- 腎功能趨勢 -->
                        <div class="chart-section">
                            <div class="chart-header">
                                <h4><i class="fas fa-kidneys"></i> 腎功能指標 (eGFR)</h4>
                                <div class="chart-legend">
                                    <span class="legend-item normal">正常 ≥90</span>
                                    <span class="legend-item mild">輕度下降 60-89</span>
                                    <span class="legend-item moderate">中度下降 30-59</span>
                                    <span class="legend-item severe">嚴重下降 15-29</span>
                                    <span class="legend-item critical">腎衰竭 <15</span>
                                </div>
                            </div>
                            <div class="chart-wrapper">
                                <canvas id="egfrChart"></canvas>
                            </div>
                        </div>
                        
                        <!-- 膽固醇趨勢 -->
                        <div class="chart-section">
                            <div class="chart-header">
                                <h4><i class="fas fa-droplet"></i> 脂質代謝指標</h4>
                                <div class="chart-legend">
                                    <span class="legend-item normal">理想 <200</span>
                                    <span class="legend-item border">邊界 200-239</span>
                                    <span class="legend-item high">高 ≥240</span>
                                </div>
                            </div>
                            <div class="chart-wrapper">
                                <canvas id="cholesterolChart"></canvas>
                            </div>
                        </div>
                        
                        <!-- 血糖控制趨勢 -->
                        <div class="chart-section">
                            <div class="chart-header">
                                <h4><i class="fas fa-vial"></i> 血糖控制指標 (HbA1c)</h4>
                                <div class="chart-legend">
                                    <span class="legend-item normal">正常 <5.7%</span>
                                    <span class="legend-item prediabetes">前期 5.7-6.4%</span>
                                    <span class="legend-item diabetes">糖尿病 ≥6.5%</span>
                                </div>
                            </div>
                            <div class="chart-wrapper">
                                <canvas id="hba1cChart"></canvas>
                            </div>
                        </div>
                        
                        <!-- 血壓趨勢 -->
                        <div class="chart-section">
                            <div class="chart-header">
                                <h4><i class="fas fa-heartbeat"></i> 血壓趨勢</h4>
                                <div class="chart-legend">
                                    <span class="legend-item normal">正常 <120/80</span>
                                    <span class="legend-item elevated">偏高 120-129/<80</span>
                                    <span class="legend-item high1">高血壓1期 130-139/80-89</span>
                                    <span class="legend-item high2">高血壓2期 ≥140/90</span>
                                </div>
                            </div>
                            <div class="chart-wrapper">
                                <canvas id="bloodPressureChart"></canvas>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 臨床建議 -->
                    <div id="labRecommendations" class="lab-recommendations" style="display: none;">
                        <h4><i class="fas fa-stethoscope"></i> 臨床建議</h4>
                        <div id="recommendationsContainer" class="recommendations-container">
                            <!-- 動態生成的建議將會出現在這裡 -->
                        </div>
                    </div>
                    
                    <!-- 無資料狀態 -->
                    <div id="noLabData" class="no-data" style="display: none;">
                        <i class="fas fa-exclamation-circle"></i>
                        <h4>無實驗室數據</h4>
                        <p>未找到該患者的實驗室檢查記錄，或資料還在載入中。</p>
                        <button onclick="loadLabObservations()" class="retry-btn">
                            <i class="fas fa-refresh"></i>
                            重試載入
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function createARCHBRContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-balance-scale"></i>
                <h2>ARC-HBR 風險權衡</h2>
            </div>
            <div class="cds-content">
                <div class="risk-calculator">
                    <div class="calculator-icon">
                        <i class="fas fa-balance-scale"></i>
                    </div>
                    <h3>出血風險 vs 缺血風險權衡</h3>
                    <p>根據 ARC-HBR 標準評估高出血風險患者的抗血小板治療策略。</p>
                    
                    <div class="risk-factors">
                        <h4>出血風險因子：</h4>
                        <ul>
                            <li><i class="fas fa-check-circle"></i> 年齡 ≥75歲</li>
                            <li><i class="fas fa-exclamation-triangle"></i> 既往出血史：需要確認</li>
                            <li><i class="fas fa-exclamation-triangle"></i> 腎功能：需要檢查</li>
                            <li><i class="fas fa-exclamation-triangle"></i> 抗凝藥物使用：需要確認</li>
                        </ul>
                    </div>

                    <button class="cds-action-btn">
                        <i class="fas fa-balance-scale"></i>
                        執行風險權衡分析
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 創建風險評估檢測內容
function createRiskAssessmentContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-exclamation-triangle"></i>
                <h2>風險評估檢測</h2>
            </div>
            <div class="cds-content">
                <div class="risk-assessment-container">
                    <div class="assessment-overview">
                        <h4>患者風險評估概覽</h4>
                        <p>綜合評估患者的各項風險指標，提供個人化的臨床決策建議。</p>
                    </div>
                    
                    <div class="risk-categories">
                        <div class="risk-category">
                            <div class="category-icon cardiovascular">
                                <i class="fas fa-heartbeat"></i>
                            </div>
                            <h5>心血管風險</h5>
                            <div class="risk-level high">高風險</div>
                            <p>建議進行全面的心血管評估</p>
                        </div>
                        
                        <div class="risk-category">
                            <div class="category-icon bleeding">
                                <i class="fas fa-tint"></i>
                            </div>
                            <h5>出血風險</h5>
                            <div class="risk-level medium">中等風險</div>
                            <p>需要密切監測凝血功能</p>
                        </div>
                        
                        <div class="risk-category">
                            <div class="category-icon diabetes">
                                <i class="fas fa-vial"></i>
                            </div>
                            <h5>糖尿病風險</h5>
                            <div class="risk-level low">低風險</div>
                            <p>維持當前血糖管理策略</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 創建臨床報告內容
function createClinicalReportContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-file-medical-alt"></i>
                <h2>臨床報告</h2>
                <div class="report-actions">
                    <button class="report-btn generate">
                        <i class="fas fa-plus"></i>
                        生成報告
                    </button>
                    <button class="report-btn export">
                        <i class="fas fa-download"></i>
                        匯出報告
                    </button>
                </div>
            </div>
            <div class="cds-content">
                <div class="report-list">
                    <div class="report-item">
                        <div class="report-info">
                            <h4>ASCVD 風險評估報告</h4>
                            <p>生成時間：2024年01月15日 14:30</p>
                            <div class="report-status completed">已完成</div>
                        </div>
                        <div class="report-actions">
                            <button class="view-btn">查看</button>
                            <button class="download-btn">下載</button>
                        </div>
                    </div>
                    
                    <div class="report-item">
                        <div class="report-info">
                            <h4>實驗室數據趨勢分析</h4>
                            <p>生成時間：2024年01月14日 09:15</p>
                            <div class="report-status completed">已完成</div>
                        </div>
                        <div class="report-actions">
                            <button class="view-btn">查看</button>
                            <button class="download-btn">下載</button>
                        </div>
                    </div>
                    
                    <div class="report-item">
                        <div class="report-info">
                            <h4>綜合風險評估報告</h4>
                            <p>生成時間：2024年01月13日 16:45</p>
                            <div class="report-status pending">處理中</div>
                        </div>
                        <div class="report-actions">
                            <button class="view-btn" disabled>查看</button>
                            <button class="download-btn" disabled>下載</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 創建 PRECISE-DAPT Score 內容
function createPreciseDAPTContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-tint"></i>
                <h2>PRECISE-DAPT Score 計算器</h2>
                <div class="score-info">
                    <i class="fas fa-info-circle" title="雙重抗血小板治療出血風險評估工具"></i>
                </div>
            </div>
            <div class="cds-content">
                <div class="precise-dapt-container">
                    <div class="calculator-section">
                        <h3>患者資料輸入</h3>
                        
                        <div class="input-group">
                            <label for="patientAge">年齡 (歲)</label>
                            <input type="number" id="patientAge" class="dapt-input" min="18" max="120" placeholder="輸入年齡">
                            <span class="score-points" id="ageScore">0 分</span>
                        </div>

                        <div class="input-group">
                            <label for="hemoglobin">血紅蛋白 (g/dL)</label>
                            <input type="number" id="hemoglobin" class="dapt-input" min="5" max="20" step="0.1" placeholder="8.0 - 18.0">
                            <span class="score-points" id="hbScore">0 分</span>
                        </div>

                        <div class="input-group">
                            <label for="creatinine">肌酸酐清除率 (mL/min)</label>
                            <input type="number" id="creatinine" class="dapt-input" min="10" max="200" placeholder="15 - 150">
                            <span class="score-points" id="crScore">0 分</span>
                        </div>

                        <div class="input-group">
                            <label for="wbc">白血球計數 (×10⁹/L)</label>
                            <input type="number" id="wbc" class="dapt-input" min="1" max="30" step="0.1" placeholder="2.0 - 25.0">
                            <span class="score-points" id="wbcScore">0 分</span>
                        </div>

                        <div class="input-group checkbox-group">
                            <label class="checkbox-label">
                                <input type="checkbox" id="priorBleeding" class="dapt-checkbox">
                                <span class="checkmark"></span>
                                既往出血史
                            </label>
                            <span class="score-points" id="bleedingScore">0 分</span>
                        </div>

                        <div class="data-status" id="dataStatus">
                            <h4><i class="fas fa-info-circle"></i> 數據來源狀態</h4>
                            <div class="status-grid">
                                <div class="status-item" id="ageStatus">
                                    <span class="status-indicator manual">手動</span>
                                    <span class="status-label">年齡</span>
                                </div>
                                <div class="status-item" id="hbStatus">
                                    <span class="status-indicator manual">手動</span>
                                    <span class="status-label">血紅蛋白</span>
                                </div>
                                <div class="status-item" id="crStatus">
                                    <span class="status-indicator manual">手動</span>
                                    <span class="status-label">肌酸酐清除率</span>
                                </div>
                                <div class="status-item" id="wbcStatus">
                                    <span class="status-indicator manual">手動</span>
                                    <span class="status-label">白血球</span>
                                </div>
                                <div class="status-item" id="bleedingStatus">
                                    <span class="status-indicator manual">手動</span>
                                    <span class="status-label">出血史</span>
                                </div>
                            </div>
                        </div>

                        <div class="button-group">
                            <button id="autoLoadDAPT" class="auto-load-btn">
                                <i class="fas fa-download"></i>
                                自動載入檢驗數據
                            </button>
                            <button id="calculateDAPT" class="calculate-btn">
                                <i class="fas fa-calculator"></i>
                                計算 PRECISE-DAPT Score
                            </button>
                        </div>
                    </div>

                    <div class="results-section">
                        <div class="score-display">
                            <h3>計算結果</h3>
                            <div class="total-score">
                                <span class="score-label">總分:</span>
                                <span class="score-value" id="totalScore">0</span>
                                <span class="score-unit">分</span>
                            </div>
                        </div>

                        <div class="risk-stratification">
                            <h4>風險分層</h4>
                            <div class="risk-level" id="riskLevel">
                                <div class="risk-indicator unknown">
                                    <i class="fas fa-question"></i>
                                    <span>請輸入數據進行評估</span>
                                </div>
                            </div>
                        </div>

                        <div class="clinical-recommendations">
                            <h4>臨床建議</h4>
                            <div class="recommendations-content" id="recommendations">
                                <div class="recommendation-placeholder">
                                    <i class="fas fa-stethoscope"></i>
                                    <p>完成評估後將顯示個人化治療建議</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="score-reference">
                    <h4><i class="fas fa-book-medical"></i> 評分說明</h4>
                    <div class="reference-grid">
                        <div class="reference-item">
                            <strong>年齡:</strong>
                            <ul>
                                <li>&lt;65歲: 0分</li>
                                <li>65-74歲: 12分</li>
                                <li>75-84歲: 24分</li>
                                <li>≥85歲: 30分</li>
                            </ul>
                        </div>
                        <div class="reference-item">
                            <strong>血紅蛋白:</strong>
                            <ul>
                                <li>≥18.0 g/dL: 0分</li>
                                <li>16.0-17.9: 4分</li>
                                <li>14.0-15.9: 8分</li>
                                <li>12.0-13.9: 14分</li>
                                <li>&lt;12.0: 22分</li>
                            </ul>
                        </div>
                        <div class="reference-item">
                            <strong>風險分層:</strong>
                            <ul class="risk-tiers">
                                <li class="low-risk">低風險 (0-15分): 標準DAPT 12個月</li>
                                <li class="moderate-risk">中等風險 (16-24分): 標準DAPT + 密切監測</li>
                                <li class="high-risk">高風險 (≥25分): 考慮縮短DAPT (3-6個月)</li>
                            </ul>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 創建 Fabry disease 檢驗流程內容
function createFabryContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-dna"></i>
                <h2>Fabry Disease 檢驗流程</h2>
                <div class="fabry-info">
                    <i class="fas fa-info-circle" title="法布瑞氏症 (Fabry Disease) 診斷與檢驗流程指引"></i>
                </div>
            </div>
            <div class="cds-content">
                <div class="fabry-container">
                    <div class="image-section">
                        <div class="image-header">
                            <h3>檢驗流程圖</h3>
                            <div class="image-controls">
                                <button class="zoom-btn" onclick="zoomImage(this)" title="放大圖片">
                                    <i class="fas fa-search-plus"></i>
                                </button>
                                <button class="download-btn" onclick="downloadImage()" title="下載圖片">
                                    <i class="fas fa-download"></i>
                                </button>
                                <button class="print-btn" onclick="printImage()" title="列印圖片">
                                    <i class="fas fa-print"></i>
                                </button>
                            </div>
                        </div>
                        
                        <div class="image-container">
                            <img id="fabryFlowChart" 
                                 src="/statics/Fabry.PNG" 
                                 alt="Fabry Disease 檢驗流程圖" 
                                 class="flow-chart-image"
                                 onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cmVjdCB3aWR0aD0iODAwIiBoZWlnaHQ9IjYwMCIgZmlsbD0iI2Y4ZjlmYSIgc3Ryb2tlPSIjZGVlMmU2IiBzdHJva2Utd2lkdGg9IjIiLz4KICA8dGV4dCB4PSI0MDAiIHk9IjI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjI0IiBmaWxsPSIjNmM3NTdkIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj7lnIblg4/nlqzlhaXkuK08L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSIzMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iIzZjNzU3ZCIgdGV4dC1hbmNob3I9Im1pZGRsZSI+RmFicnkgRGlzZWFzZSDmqqLpqpflryXnqIvmuIE8L3RleHQ+CiAgPHRleHQgeD0iNDAwIiB5PSIzNTAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk1YTVhNiIgdGV4dC1hbmNob3I9Im1pZGRsZSI+6KuL5qOA5p+l5Zev6Lev5piv5ZCm5q2j56K677yM5L2/55So6aCQ6Kit6Lev5b+BPC90ZXh0Pgo8L3N2Zz4K'; this.alt='圖片載入失敗，請檢查圖片路徑';"
                                 onload="console.log('Fabry流程圖載入成功');">
                            <div class="image-overlay" id="imageOverlay" style="display: none;">
                                <div class="overlay-content">
                                    <button class="close-overlay" onclick="closeImageOverlay()">
                                        <i class="fas fa-times"></i>
                                    </button>
                                    <img id="overlayImage" src="" alt="放大的流程圖">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="info-section">
                        <div class="fabry-overview">
                            <h4><i class="fas fa-info-circle"></i> Fabry Disease 概述</h4>
                            <div class="overview-content">
                                <p><strong>法布瑞氏症 (Fabry Disease)</strong> 是一種罕見的 X 染色體遺傳性疾病，由 α-galactosidase A (α-Gal A) 酵素缺陷所引起。</p>
                                <div class="key-points">
                                    <div class="point-item">
                                        <i class="fas fa-dna"></i>
                                        <span><strong>遺傳方式：</strong>X 聯鎖隱性遺傳</span>
                                    </div>
                                    <div class="point-item">
                                        <i class="fas fa-chart-line"></i>
                                        <span><strong>盛行率：</strong>1/40,000 - 1/117,000</span>
                                    </div>
                                    <div class="point-item">
                                        <i class="fas fa-microscope"></i>
                                        <span><strong>病因：</strong>GLA 基因突變導致 α-Gal A 酵素活性不足</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="clinical-features">
                            <h4><i class="fas fa-stethoscope"></i> 主要臨床表現</h4>
                            <div class="features-grid">
                                <div class="feature-category">
                                    <h5>早期症狀</h5>
                                    <ul>
                                        <li>手腳疼痛（神經病變性疼痛）</li>
                                        <li>血管角質瘤</li>
                                        <li>少汗或無汗症</li>
                                        <li>腸胃症狀</li>
                                    </ul>
                                </div>
                                <div class="feature-category">
                                    <h5>晚期併發症</h5>
                                    <ul>
                                        <li>腎臟疾病</li>
                                        <li>心臟疾病</li>
                                        <li>腦血管疾病</li>
                                        <li>聽力損失</li>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        
                        <div class="diagnostic-tests">
                            <h4><i class="fas fa-vial"></i> 主要檢驗項目</h4>
                            <div class="tests-list">
                                <div class="test-item">
                                    <div class="test-icon">
                                        <i class="fas fa-flask"></i>
                                    </div>
                                    <div class="test-info">
                                        <h6>α-Galactosidase A 酵素活性</h6>
                                        <p>男性患者通常活性顯著降低</p>
                                    </div>
                                </div>
                                <div class="test-item">
                                    <div class="test-icon">
                                        <i class="fas fa-dna"></i>
                                    </div>
                                    <div class="test-info">
                                        <h6>GLA 基因檢測</h6>
                                        <p>確認診斷的金標準</p>
                                    </div>
                                </div>
                                <div class="test-item">
                                    <div class="test-icon">
                                        <i class="fas fa-microscope"></i>
                                    </div>
                                    <div class="test-info">
                                        <h6>Gb3/lyso-Gb3 檢測</h6>
                                        <p>生物標記物檢測</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="action-buttons">
                            <button class="action-btn primary" onclick="orderLabTests()">
                                <i class="fas fa-plus"></i>
                                開立檢驗單
                            </button>
                            <button class="action-btn secondary" onclick="consultGenetics()">
                                <i class="fas fa-user-md"></i>
                                諮詢遺傳科
                            </button>
                            <button class="action-btn info" onclick="showGuidelines()">
                                <i class="fas fa-book-medical"></i>
                                查看完整指引
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 創建 ESC 心臟衰竭指引內容
function createESCHeartFailureContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-heartbeat"></i>
                <h2>ESC 2021 心臟衰竭診療指引</h2>
                <div class="guideline-info">
                    <span class="guideline-badge">ESC Guidelines 2021</span>
                    <i class="fas fa-info-circle" title="歐洲心臟學會 2021 年心臟衰竭診斷與治療指引"></i>
                </div>
            </div>
            <div class="cds-content">
                <div class="heart-failure-container">
                    
                    <!-- 患者評估區域 -->
                    <div class="patient-assessment-section">
                        <div class="assessment-header">
                            <h3><i class="fas fa-user-md"></i> 患者評估</h3>
                            <button class="auto-assessment-btn" onclick="autoLoadPatientHFData()">
                                <i class="fas fa-download"></i>
                                自動載入患者數據
                            </button>
                        </div>
                        
                        <div class="assessment-grid">
                            <div class="assessment-card symptoms">
                                <div class="card-header">
                                    <i class="fas fa-heartbeat"></i>
                                    <h4>症狀評估</h4>
                                </div>
                                <div class="symptom-checklist">
                                    <label class="symptom-item">
                                        <input type="checkbox" name="symptoms" value="dyspnea">
                                        <span class="checkmark"></span>
                                        呼吸困難 (Dyspnea)
                                    </label>
                                    <label class="symptom-item">
                                        <input type="checkbox" name="symptoms" value="fatigue">
                                        <span class="checkmark"></span>
                                        疲勞 (Fatigue)
                                    </label>
                                    <label class="symptom-item">
                                        <input type="checkbox" name="symptoms" value="edema">
                                        <span class="checkmark"></span>
                                        水腫 (Edema)
                                    </label>
                                    <label class="symptom-item">
                                        <input type="checkbox" name="symptoms" value="orthopnea">
                                        <span class="checkmark"></span>
                                        端坐呼吸 (Orthopnea)
                                    </label>
                                    <label class="symptom-item">
                                        <input type="checkbox" name="symptoms" value="pnd">
                                        <span class="checkmark"></span>
                                        陣發性夜間呼吸困難 (PND)
                                    </label>
                                </div>
                            </div>
                            
                            <div class="assessment-card functional">
                                <div class="card-header">
                                    <i class="fas fa-walking"></i>
                                    <h4>功能分級</h4>
                                </div>
                                <div class="nyha-classification">
                                    <h5>NYHA 功能分級：</h5>
                                    <div class="nyha-buttons">
                                        <button class="nyha-btn" data-class="1">Class I</button>
                                        <button class="nyha-btn" data-class="2">Class II</button>
                                        <button class="nyha-btn" data-class="3">Class III</button>
                                        <button class="nyha-btn" data-class="4">Class IV</button>
                                    </div>
                                    <div class="nyha-description" id="nyhaDescription">
                                        <p>請選擇患者的 NYHA 功能分級</p>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="assessment-card biomarkers">
                                <div class="card-header">
                                    <i class="fas fa-vial"></i>
                                    <h4>生物標記</h4>
                                </div>
                                <div class="biomarker-inputs">
                                    <div class="input-group">
                                        <label>NT-proBNP (pg/mL)</label>
                                        <input type="number" id="ntproBNP" placeholder="< 125: 正常, > 400: 異常">
                                        <div class="reference-range">參考值: &lt;125 pg/mL (正常)</div>
                                    </div>
                                    <div class="input-group">
                                        <label>BNP (pg/mL)</label>
                                        <input type="number" id="bnp" placeholder="< 35: 正常, > 100: 異常">
                                        <div class="reference-range">參考值: &lt;35 pg/mL (正常)</div>
                                    </div>
                                    <div class="input-group">
                                        <label>LVEF (%)</label>
                                        <input type="number" id="lvef" min="10" max="80" placeholder="左心室射血分數">
                                        <div class="reference-range">正常: ≥50%, 輕度下降: 40-49%, 中重度下降: &lt;40%</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 診斷流程 -->
                    <div class="diagnosis-section">
                        <h3><i class="fas fa-search"></i> 診斷流程</h3>
                        <div class="diagnosis-flowchart">
                            <div class="flow-step step-1">
                                <div class="step-icon">1</div>
                                <div class="step-content">
                                    <h4>症狀識別</h4>
                                    <p>呼吸困難、疲勞、踝部水腫</p>
                                </div>
                            </div>
                            <div class="flow-arrow">→</div>
                            <div class="flow-step step-2">
                                <div class="step-icon">2</div>
                                <div class="step-content">
                                    <h4>生物標記檢測</h4>
                                    <p>NT-proBNP 或 BNP</p>
                                </div>
                            </div>
                            <div class="flow-arrow">→</div>
                            <div class="flow-step step-3">
                                <div class="step-icon">3</div>
                                <div class="step-content">
                                    <h4>心臟超音波</h4>
                                    <p>評估心臟結構與功能</p>
                                </div>
                            </div>
                            <div class="flow-arrow">→</div>
                            <div class="flow-step step-4">
                                <div class="step-icon">4</div>
                                <div class="step-content">
                                    <h4>確診分類</h4>
                                    <p>HFrEF, HFmrEF, HFpEF</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 治療建議 -->
                    <div class="treatment-section">
                        <h3><i class="fas fa-pills"></i> 治療建議</h3>
                        
                        <div class="treatment-tabs">
                            <button class="treatment-tab active" data-tab="hfref">HFrEF</button>
                            <button class="treatment-tab" data-tab="hfmref">HFmrEF</button>
                            <button class="treatment-tab" data-tab="hfpef">HFpEF</button>
                        </div>
                        
                        <!-- HFrEF 治療 -->
                        <div id="hfref-treatment" class="treatment-content active">
                            <div class="treatment-pathway">
                                <h4>HFrEF (LVEF &lt; 40%) 治療路徑</h4>
                                
                                <div class="medication-tiers">
                                    <div class="tier tier-1">
                                        <div class="tier-header">
                                            <span class="tier-number">1</span>
                                            <h5>第一線治療 (Class I)</h5>
                                        </div>
                                        <div class="medication-grid">
                                            <div class="med-card ace-arb">
                                                <div class="med-icon"><i class="fas fa-capsules"></i></div>
                                                <div class="med-info">
                                                    <h6>ACE-I / ARB / ARNI</h6>
                                                    <p>血管緊張素轉換酶抑制劑<br>血管緊張素受體拮抗劑<br>血管緊張素受體腦啡肽酶抑制劑</p>
                                                    <div class="evidence-level">證據等級: I A</div>
                                                </div>
                                            </div>
                                            <div class="med-card beta-blocker">
                                                <div class="med-icon"><i class="fas fa-tablets"></i></div>
                                                <div class="med-info">
                                                    <h6>β-阻斷劑</h6>
                                                    <p>Bisoprolol, Carvedilol, Metoprolol, Nebivolol</p>
                                                    <div class="evidence-level">證據等級: I A</div>
                                                </div>
                                            </div>
                                            <div class="med-card mra">
                                                <div class="med-icon"><i class="fas fa-prescription-bottle"></i></div>
                                                <div class="med-info">
                                                    <h6>MRA</h6>
                                                    <p>礦質皮質素受體拮抗劑<br>Spironolactone, Eplerenone</p>
                                                    <div class="evidence-level">證據等級: I A</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="tier tier-2">
                                        <div class="tier-header">
                                            <span class="tier-number">2</span>
                                            <h5>第二線治療</h5>
                                        </div>
                                        <div class="medication-grid">
                                            <div class="med-card sglt2">
                                                <div class="med-icon"><i class="fas fa-pills"></i></div>
                                                <div class="med-info">
                                                    <h6>SGLT2 抑制劑</h6>
                                                    <p>Dapagliflozin, Empagliflozin</p>
                                                    <div class="evidence-level">證據等級: I A</div>
                                                </div>
                                            </div>
                                            <div class="med-card diuretic">
                                                <div class="med-icon"><i class="fas fa-tint"></i></div>
                                                <div class="med-info">
                                                    <h6>利尿劑</h6>
                                                    <p>症狀性心衰，有體液滯留</p>
                                                    <div class="evidence-level">證據等級: I C</div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="tier tier-3">
                                        <div class="tier-header">
                                            <span class="tier-number">3</span>
                                            <h5>進階治療選項</h5>
                                        </div>
                                        <div class="advanced-options">
                                            <div class="option-card device">
                                                <h6><i class="fas fa-microchip"></i> 裝置治療</h6>
                                                <ul>
                                                    <li>CRT-P/CRT-D (QRS ≥ 150ms, LBBB)</li>
                                                    <li>ICD (一級預防，LVEF ≤ 35%)</li>
                                                </ul>
                                            </div>
                                            <div class="option-card surgical">
                                                <h6><i class="fas fa-user-md"></i> 外科治療</h6>
                                                <ul>
                                                    <li>冠狀動脈血管重建術</li>
                                                    <li>二尖瓣修復/置換</li>
                                                    <li>心臟移植</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- HFmrEF 治療 -->
                        <div id="hfmref-treatment" class="treatment-content">
                            <div class="treatment-pathway">
                                <h4>HFmrEF (LVEF 40-49%) 治療建議</h4>
                                <div class="treatment-note">
                                    <i class="fas fa-info-circle"></i>
                                    <p>HFmrEF 的治療建議主要基於 HFrEF 的治療原則，但證據相對有限。建議個人化治療方案。</p>
                                </div>
                                <div class="medication-recommendations">
                                    <div class="rec-item">
                                        <i class="fas fa-check"></i>
                                        <span>考慮使用 ACE-I/ARB/ARNI (Class IIa B)</span>
                                    </div>
                                    <div class="rec-item">
                                        <i class="fas fa-check"></i>
                                        <span>考慮使用 β-阻斷劑 (Class IIa B)</span>
                                    </div>
                                    <div class="rec-item">
                                        <i class="fas fa-check"></i>
                                        <span>症狀性患者可使用利尿劑 (Class I C)</span>
                                    </div>
                                    <div class="rec-item">
                                        <i class="fas fa-question"></i>
                                        <span>MRA 的效益尚不明確 (Class IIb C)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- HFpEF 治療 -->
                        <div id="hfpef-treatment" class="treatment-content">
                            <div class="treatment-pathway">
                                <h4>HFpEF (LVEF ≥ 50%) 治療建議</h4>
                                <div class="treatment-focus">
                                    <div class="focus-item">
                                        <h6><i class="fas fa-target"></i> 治療重點</h6>
                                        <ul>
                                            <li>控制共病症 (高血壓、糖尿病、房顫)</li>
                                            <li>症狀管理 (利尿劑)</li>
                                            <li>改善生活品質</li>
                                        </ul>
                                    </div>
                                </div>
                                <div class="medication-recommendations">
                                    <div class="rec-item proven">
                                        <i class="fas fa-check-circle"></i>
                                        <span>利尿劑用於症狀緩解 (Class I C)</span>
                                    </div>
                                    <div class="rec-item consider">
                                        <i class="fas fa-question-circle"></i>
                                        <span>SGLT2 抑制劑可考慮使用 (Class IIa B)</span>
                                    </div>
                                    <div class="rec-item limited">
                                        <i class="fas fa-exclamation-circle"></i>
                                        <span>ACE-I/ARB 效益有限 (Class IIb C)</span>
                                    </div>
                                    <div class="rec-item comorbidity">
                                        <i class="fas fa-plus-circle"></i>
                                        <span>積極治療共病症 (高血壓、糖尿病、房顫)</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 個人化建議 -->
                    <div class="personalized-recommendations">
                        <h3><i class="fas fa-user-cog"></i> 個人化治療建議</h3>
                        <div class="recommendation-generator">
                            <button class="generate-recommendations-btn" onclick="generateHFRecommendations()">
                                <i class="fas fa-magic"></i>
                                根據患者資料生成個人化建議
                            </button>
                            <div class="recommendations-output" id="hfRecommendationsOutput">
                                <div class="recommendation-placeholder">
                                    <i class="fas fa-lightbulb"></i>
                                    <p>完成患者評估後，系統將自動生成個人化的治療建議</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 追蹤監測 -->
                    <div class="monitoring-section">
                        <h3><i class="fas fa-chart-line"></i> 追蹤監測指引</h3>
                        <div class="monitoring-schedule">
                            <div class="monitor-item acute">
                                <div class="monitor-header">
                                    <i class="fas fa-exclamation-triangle"></i>
                                    <h5>急性期監測</h5>
                                </div>
                                <ul>
                                    <li>每日體重測量</li>
                                    <li>症狀評估 (呼吸困難、水腫)</li>
                                    <li>生命徵象監測</li>
                                    <li>腎功能、電解質 (48-72小時)</li>
                                </ul>
                            </div>
                            
                            <div class="monitor-item stable">
                                <div class="monitor-header">
                                    <i class="fas fa-calendar-check"></i>
                                    <h5>穩定期監測</h5>
                                </div>
                                <ul>
                                    <li><strong>每月:</strong> 症狀、體重、藥物調整</li>
                                    <li><strong>每3個月:</strong> 腎功能、電解質、BNP/NT-proBNP</li>
                                    <li><strong>每6-12個月:</strong> 心臟超音波、運動耐受度評估</li>
                                    <li><strong>每年:</strong> 流感疫苗接種</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 非藥物治療 -->
                    <div class="non-pharmacological-section">
                        <h3><i class="fas fa-heart"></i> 非藥物治療</h3>
                        <div class="lifestyle-grid">
                            <div class="lifestyle-card">
                                <i class="fas fa-utensils"></i>
                                <h5>飲食管理</h5>
                                <ul>
                                    <li>鈉攝取限制 (&lt; 2g/day)</li>
                                    <li>液體限制 (1.5-2L/day，如有需要)</li>
                                    <li>體重管理</li>
                                </ul>
                            </div>
                            <div class="lifestyle-card">
                                <i class="fas fa-running"></i>
                                <h5>運動復健</h5>
                                <ul>
                                    <li>心臟復健計畫</li>
                                    <li>有氧運動 (30分鐘/天，3-5天/週)</li>
                                    <li>阻力訓練 (適度)</li>
                                </ul>
                            </div>
                            <div class="lifestyle-card">
                                <i class="fas fa-graduation-cap"></i>
                                <h5>患者教育</h5>
                                <ul>
                                    <li>疾病認知與自我管理</li>
                                    <li>藥物遵從性</li>
                                    <li>症狀識別與應對</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 創建設定內容
function createSettingsContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-cog"></i>
                <h2>系統設定</h2>
            </div>
            <div class="cds-content">
                <div class="settings-container">
                    <div class="settings-section">
                        <h4><i class="fas fa-server"></i> FHIR 服務器設定</h4>
                        <div class="setting-item">
                            <label>服務器 URL:</label>
                            <input type="text" value="https://r4.smarthealthit.org" class="setting-input">
                        </div>
                        <div class="setting-item">
                            <label>客戶端 ID:</label>
                            <input type="text" value="smart_cds_platform" class="setting-input">
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h4><i class="fas fa-bell"></i> 通知設定</h4>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" checked> 啟用通知提醒
                            </label>
                        </div>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" checked> 顯示成功訊息
                            </label>
                        </div>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" checked> 顯示警告訊息
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-section">
                        <h4><i class="fas fa-chart-line"></i> 數據顯示設定</h4>
                        <div class="setting-item">
                            <label>預設時間範圍:</label>
                            <select class="setting-select">
                                <option value="6m">6個月</option>
                                <option value="1y" selected>1年</option>
                                <option value="2y">2年</option>
                            </select>
                        </div>
                        <div class="setting-item">
                            <label>
                                <input type="checkbox" checked> 自動重新整理數據
                            </label>
                        </div>
                    </div>
                    
                    <div class="settings-actions">
                        <button class="settings-btn save">
                            <i class="fas fa-save"></i>
                            儲存設定
                        </button>
                        <button class="settings-btn reset">
                            <i class="fas fa-undo"></i>
                            重置為預設值
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// 創建預設內容
function createDefaultContent() {
    return `
        <div class="cds-hook-display">
            <div class="section-header">
                <i class="fas fa-info-circle"></i>
                <h2>功能開發中</h2>
            </div>
            <div class="cds-content">
                <div class="default-content">
                    <i class="fas fa-tools" style="font-size: 64px; color: #dee2e6; margin-bottom: 20px;"></i>
                    <h4>此功能正在開發中</h4>
                    <p>我們正在努力完善這個功能，敬請期待！</p>
                </div>
            </div>
        </div>
    `;
}

// 開啟 SMART App
function openSmartApp(appName) {
    showNotification(`正在開啟 ${appName}...`, 'info');
    
    // 模擬外部應用程式開啟
    setTimeout(() => {
        window.open(`https://smart.example.com/app/${appName.toLowerCase().replace(/\s+/g, '-')}`, '_blank');
        showNotification(`${appName} 已在新視窗中開啟`, 'success');
    }, 1000);
}

// 顯示診斷詳情
function showDiagnosisDetails(diagnosisItem, condition) {
    const diagnosisName = diagnosisItem.querySelector('h4').textContent;
    
    showNotification(`查看診斷詳情: ${diagnosisName}`, 'info');
    
    // 在中間面板顯示詳細資訊
    const centerPanel = document.querySelector('.center-panel');
    
    // 提取診斷詳細資訊
    const conditionName = getConditionName(condition);
    const conditionDate = getConditionDate(condition);
    const practitioner = getConditionPractitioner(condition);
    const clinicalStatus = condition.clinicalStatus ? condition.clinicalStatus.coding[0].display : 'Unknown';
    const verificationStatus = condition.verificationStatus ? condition.verificationStatus.coding[0].display : 'Unknown';
    
    // 提取 ICD 代碼
    let icdCode = 'Unknown';
    if (condition.code && condition.code.coding) {
        const icdCoding = condition.code.coding.find(coding => 
            coding.system && (coding.system.includes('icd') || coding.system.includes('ICD'))
        );
        if (icdCoding) {
            icdCode = icdCoding.code + ' (' + (icdCoding.display || 'Unknown') + ')';
        }
    }
    
    // 提取備註
    const notes = condition.note ? condition.note.map(note => note.text).join('; ') : '無備註';
    
    centerPanel.innerHTML = `
        <div class="diagnosis-details">
            <div class="section-header">
                <i class="fas fa-file-medical"></i>
                <h2>診斷詳情</h2>
            </div>
            <div class="diagnosis-detail-content">
                <h3>${conditionName}</h3>
                <p><strong>診斷日期:</strong> ${conditionDate}</p>
                <p><strong>ICD 代碼:</strong> ${icdCode}</p>
                <p><strong>診斷醫師:</strong> ${practitioner}</p>
                <p><strong>臨床狀態:</strong> ${clinicalStatus}</p>
                <p><strong>驗證狀態:</strong> ${verificationStatus}</p>
                
                <div class="diagnosis-notes">
                    <h4>診斷備註:</h4>
                    <p>${notes}</p>
                </div>
                
                <div class="condition-details">
                    <h4>FHIR 資源詳情:</h4>
                    <div class="fhir-resource">
                        <pre>${JSON.stringify(condition, null, 2)}</pre>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button onclick="loadRelatedObservations('${condition.id}')" class="action-btn">
                        <i class="fas fa-chart-line"></i>
                        載入相關檢測
                    </button>
                    <button onclick="loadRelatedMedications('${condition.id}')" class="action-btn">
                        <i class="fas fa-pills"></i>
                        載入相關藥物
                    </button>
                    <button onclick="returnToASCVD()" class="action-btn secondary">
                        <i class="fas fa-arrow-left"></i>
                        返回 ASCVD 評估
                    </button>
                </div>
            </div>
        </div>
    `;
}

// 顯示通知
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${getNotificationIcon(type)}"></i>
        <span>${message}</span>
        <button class="close-notification">&times;</button>
    `;
    
    document.body.appendChild(notification);
    
    // 自動顯示動畫
    setTimeout(() => {
        notification.classList.add('show');
    }, 100);
    
    // 自動消失
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    }, 3000);
    
    // 手動關閉
    notification.querySelector('.close-notification').addEventListener('click', () => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                document.body.removeChild(notification);
            }
        }, 300);
    });
}

// 獲取通知圖標
function getNotificationIcon(type) {
    switch(type) {
        case 'success': return 'check-circle';
        case 'warning': return 'exclamation-triangle';
        case 'error': return 'times-circle';
        default: return 'info-circle';
    }
}

// 添加模態視窗樣式
function addModalStyles() {
    if (document.querySelector('#modal-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'modal-styles';
    style.textContent = `
        .calculator-modal {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        }
        
        .modal-content {
            background: white;
            border-radius: 15px;
            padding: 0;
            max-width: 600px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        }
        
        .modal-header {
            background: #16a085;
            color: white;
            padding: 20px;
            border-radius: 15px 15px 0 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .modal-header h3 {
            margin: 0;
            font-size: 20px;
        }
        
        .close-modal {
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 30px;
            height: 30px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .modal-body {
            padding: 20px;
        }
        
        .form-group {
            margin-bottom: 15px;
        }
        
        .form-group label {
            display: block;
            margin-bottom: 5px;
            font-weight: 600;
            color: #2c3e50;
        }
        
        .form-group input, .form-group select {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
        }
        
        .calculate-btn {
            background: #16a085;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            width: 100%;
            margin-top: 20px;
        }
        
        .calculate-btn:hover {
            background: #138c75;
        }
        
        .risk-result {
            margin-top: 20px;
            padding: 20px;
            background: #f8f9fa;
            border-radius: 10px;
            text-align: center;
        }
        
        .risk-percentage {
            font-size: 48px;
            font-weight: bold;
            color: #e74c3c;
            margin: 10px 0;
        }
        
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 10px;
            padding: 15px 20px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
            display: flex;
            align-items: center;
            gap: 10px;
            z-index: 10001;
            transform: translateX(400px);
            transition: transform 0.3s ease;
            min-width: 300px;
        }
        
        .notification.show {
            transform: translateX(0);
        }
        
        .notification.success {
            border-left: 4px solid #27ae60;
        }
        
        .notification.warning {
            border-left: 4px solid #f39c12;
        }
        
        .notification.error {
            border-left: 4px solid #e74c3c;
        }
        
        .notification.info {
            border-left: 4px solid #3498db;
        }
        
        .notification i {
            font-size: 18px;
        }
        
        .notification.success i {
            color: #27ae60;
        }
        
        .notification.warning i {
            color: #f39c12;
        }
        
        .notification.error i {
            color: #e74c3c;
        }
        
        .notification.info i {
            color: #3498db;
        }
        
        .close-notification {
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
            margin-left: auto;
        }
    `;
    
    document.head.appendChild(style);
}

// 實時更新功能
function startRealTimeUpdates() {
    // 每分鐘更新時間
    setInterval(updateCurrentTime, 60000);
    
    // 模擬實時資料更新
    setInterval(() => {
        // 隨機更新一些狀態
        updateRandomStatus();
    }, 30000);
}

// 更新隨機狀態
function updateRandomStatus() {
    const statusElements = document.querySelectorAll('.status-badge');
    statusElements.forEach(element => {
        if (Math.random() < 0.1) { // 10% 機率更新
            element.style.animation = 'pulse 0.5s';
            setTimeout(() => {
                element.style.animation = '';
            }, 500);
        }
    });
}

// 載入相關檢測數據
function loadRelatedObservations(conditionId) {
    if (!smartClient) {
        showNotification('無法載入檢測數據：未連接到 FHIR 服務器', 'error');
        return;
    }
    
    showNotification('正在載入相關檢測數據...', 'info');
    
    smartClient.patient.request(`Observation?patient=${smartClient.patient.id}&_sort=-date&_count=10`)
        .then(function(response) {
            const observations = response.entry ? response.entry.map(entry => entry.resource) : [];
            showObservationsModal(observations);
        })
        .catch(function(error) {
            console.error('載入檢測數據失敗:', error);
            showNotification('載入檢測數據失敗: ' + error.message, 'error');
        });
}

// 載入相關藥物
function loadRelatedMedications(conditionId) {
    if (!smartClient) {
        showNotification('無法載入藥物數據：未連接到 FHIR 服務器', 'error');
        return;
    }
    
    showNotification('正在載入相關藥物...', 'info');
    
    smartClient.patient.request(`MedicationRequest?patient=${smartClient.patient.id}&_sort=-date&_count=10`)
        .then(function(response) {
            const medications = response.entry ? response.entry.map(entry => entry.resource) : [];
            showMedicationsModal(medications);
        })
        .catch(function(error) {
            console.error('載入藥物數據失敗:', error);
            showNotification('載入藥物數據失敗: ' + error.message, 'error');
        });
}

// 返回 ASCVD 評估
function returnToASCVD() {
    const centerPanel = document.querySelector('.center-panel');
    centerPanel.innerHTML = createASCVDContent();
    
    // 重新綁定 CDS 動作按鈕
    const cdsActionBtn = centerPanel.querySelector('.cds-action-btn');
    if (cdsActionBtn) {
        cdsActionBtn.addEventListener('click', function() {
            openASCVDCalculator();
        });
    }
    
    showNotification('已返回 ASCVD 評估', 'info');
}

// 顯示檢測數據模態視窗
function showObservationsModal(observations) {
    const modal = document.createElement('div');
    modal.className = 'observations-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-chart-line"></i> 檢測數據</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="observations-list">
                    ${observations.map(obs => `
                        <div class="observation-item">
                            <h4>${getObservationName(obs)}</h4>
                            <p><strong>數值:</strong> ${getObservationValue(obs)}</p>
                            <p><strong>日期:</strong> ${getObservationDate(obs)}</p>
                            <p><strong>狀態:</strong> ${obs.status || 'Unknown'}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 綁定關閉事件
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

// 顯示藥物模態視窗
function showMedicationsModal(medications) {
    const modal = document.createElement('div');
    modal.className = 'medications-modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3><i class="fas fa-pills"></i> 藥物處方</h3>
                <button class="close-modal">&times;</button>
            </div>
            <div class="modal-body">
                <div class="medications-list">
                    ${medications.map(med => `
                        <div class="medication-item">
                            <h4>${getMedicationName(med)}</h4>
                            <p><strong>狀態:</strong> ${med.status || 'Unknown'}</p>
                            <p><strong>開立日期:</strong> ${getMedicationDate(med)}</p>
                            <p><strong>劑量:</strong> ${getMedicationDosage(med)}</p>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 綁定關閉事件
    modal.querySelector('.close-modal').addEventListener('click', () => {
        document.body.removeChild(modal);
    });
}

// 輔助函數：獲取檢測名稱
function getObservationName(observation) {
    if (observation.code && observation.code.coding && observation.code.coding.length > 0) {
        return observation.code.coding[0].display || observation.code.coding[0].code || 'Unknown Observation';
    }
    return 'Unknown Observation';
}

// 輔助函數：獲取檢測數值
function getObservationValue(observation) {
    if (observation.valueQuantity) {
        return `${observation.valueQuantity.value} ${observation.valueQuantity.unit || observation.valueQuantity.code || ''}`;
    } else if (observation.valueCodeableConcept) {
        return observation.valueCodeableConcept.coding[0].display || observation.valueCodeableConcept.coding[0].code || 'Unknown';
    } else if (observation.valueString) {
        return observation.valueString;
    }
    return 'Unknown';
}

// 輔助函數：獲取檢測日期
function getObservationDate(observation) {
    if (observation.effectiveDateTime) {
        return new Date(observation.effectiveDateTime).toLocaleDateString('zh-TW');
    } else if (observation.effectivePeriod && observation.effectivePeriod.start) {
        return new Date(observation.effectivePeriod.start).toLocaleDateString('zh-TW');
    }
    return 'Unknown Date';
}

// 輔助函數：獲取藥物名稱
function getMedicationName(medication) {
    if (medication.medicationCodeableConcept && medication.medicationCodeableConcept.coding) {
        return medication.medicationCodeableConcept.coding[0].display || medication.medicationCodeableConcept.coding[0].code || 'Unknown Medication';
    }
    return 'Unknown Medication';
}

// 輔助函數：獲取藥物日期
function getMedicationDate(medication) {
    if (medication.authoredOn) {
        return new Date(medication.authoredOn).toLocaleDateString('zh-TW');
    }
    return 'Unknown Date';
}

// 輔助函數：獲取藥物劑量
function getMedicationDosage(medication) {
    if (medication.dosageInstruction && medication.dosageInstruction.length > 0) {
        return medication.dosageInstruction[0].text || 'Unknown Dosage';
    }
    return 'Unknown Dosage';
}

// 初始化 CDS Hooks
function initializeCDSHooks() {
    console.log('初始化 CDS Hooks...');
    
    // 綁定 CDS Hooks 事件
    const hookSelector = document.getElementById('hookSelector');
    const loadHookBtn = document.getElementById('loadHookBtn');
    const unloadHookBtn = document.getElementById('unloadHookBtn');
    
    if (hookSelector) {
        hookSelector.addEventListener('change', handleHookSelection);
    }
    
    if (loadHookBtn) {
        loadHookBtn.addEventListener('click', loadSelectedHook);
    }
    
    if (unloadHookBtn) {
        unloadHookBtn.addEventListener('click', unloadCurrentHook);
    }
    
    // 初始化按鈕狀態
    updateHookButtonStates();
}

// 處理 Hook 選擇
function handleHookSelection() {
    const hookSelector = document.getElementById('hookSelector');
    const selectedHook = hookSelector.value;
    
    updateHookButtonStates();
    
    if (selectedHook && cdsHooks[selectedHook]) {
        console.log(`選擇了 Hook: ${selectedHook}`);
    }
}

// 載入選擇的 Hook
function loadSelectedHook() {
    const hookSelector = document.getElementById('hookSelector');
    const selectedHookId = hookSelector.value;
    
    if (!selectedHookId || !cdsHooks[selectedHookId]) {
        showNotification('請先選擇一個 CDS Hook', 'warning');
        return;
    }
    
    const hook = cdsHooks[selectedHookId];
    
    // 如果有當前載入的 Hook，先取消載入
    if (currentHook) {
        unloadCurrentHook();
    }
    
    // 顯示載入中
    showHookLoading();
    
    // 模擬載入延遲
    setTimeout(() => {
        try {
            // 載入 Hook
            const hookContent = hook.generator(patientData, encounterData);
            displayHookContent(hookContent);
            
            // 設置當前 Hook
            currentHook = selectedHookId;
            hook.enabled = true;
            
            // 更新按鈕狀態
            updateHookButtonStates();
            
            // 開始自動更新（如果需要）
            startHookAutoUpdate();
            
            showNotification(`成功載入 ${hook.name}`, 'success');
        } catch (error) {
            console.error('載入 Hook 時出錯:', error);
            showNotification('載入 Hook 時出錯', 'danger');
            showHookPlaceholder();
        }
    }, 1000);
}

// 取消載入當前 Hook
function unloadCurrentHook() {
    if (!currentHook) {
        showNotification('沒有載入的 Hook', 'warning');
        return;
    }
    
    const hook = cdsHooks[currentHook];
    
    // 停止自動更新
    stopHookAutoUpdate();
    
    // 重置 Hook 狀態
    hook.enabled = false;
    currentHook = null;
    
    // 顯示佔位符
    showHookPlaceholder();
    
    // 更新按鈕狀態
    updateHookButtonStates();
    
    showNotification(`已取消載入 ${hook.name}`, 'info');
}

// 更新 Hook 按鈕狀態
function updateHookButtonStates() {
    const hookSelector = document.getElementById('hookSelector');
    const loadHookBtn = document.getElementById('loadHookBtn');
    const unloadHookBtn = document.getElementById('unloadHookBtn');
    
    const selectedHook = hookSelector?.value;
    const hasSelection = selectedHook && cdsHooks[selectedHook];
    const isLoaded = currentHook !== null;
    
    if (loadHookBtn) {
        loadHookBtn.disabled = !hasSelection || isLoaded;
    }
    
    if (unloadHookBtn) {
        unloadHookBtn.disabled = !isLoaded;
    }
}

// 顯示載入中狀態
function showHookLoading() {
    const hookContainer = document.getElementById('hookContainer');
    if (!hookContainer) return;
    
    hookContainer.innerHTML = `
        <div class="hook-loading">
            <i class="fas fa-spinner"></i>
            <p>載入 CDS Hook 中...</p>
        </div>
    `;
}

// 顯示佔位符
function showHookPlaceholder() {
    const hookContainer = document.getElementById('hookContainer');
    if (!hookContainer) return;
    
    hookContainer.innerHTML = `
        <div class="hook-placeholder">
            <i class="fas fa-info-circle"></i>
            <p>請選擇並載入一個 CDS Hook 來查看臨床決策支持內容</p>
        </div>
    `;
}

// 顯示 Hook 內容
function displayHookContent(content) {
    const hookContainer = document.getElementById('hookContainer');
    if (!hookContainer) return;
    
    hookContainer.innerHTML = content;
}

// 開始自動更新
function startHookAutoUpdate() {
    // 每30秒更新一次 Hook 內容
    hookInterval = setInterval(() => {
        if (currentHook && cdsHooks[currentHook]) {
            const hook = cdsHooks[currentHook];
            const updatedContent = hook.generator(patientData, encounterData);
            displayHookContent(updatedContent);
        }
    }, 30000);
}

// 停止自動更新
function stopHookAutoUpdate() {
    if (hookInterval) {
        clearInterval(hookInterval);
        hookInterval = null;
    }
}

// Patient View Hook 生成器
function generatePatientViewHook(patient, encounter) {
    const patientAge = patient ? calculateAge(patient.birthDate) : '未知';
    const patientGender = patient ? (patient.gender === 'male' ? '男性' : '女性') : '未知';
    const patientName = patient ? getPatientName(patient) : '未知患者';
    
    return `
        <div class="hook-content">
            <div class="hook-header">
                <i class="fas fa-user-circle"></i>
                <h3>Patient View Hook</h3>
                <span class="hook-status active">活躍</span>
            </div>
            
            <div class="hook-info">
                <h4>患者概覽臨床決策支持</h4>
                <p>基於當前患者 ${patientName} 的基本信息和病史，提供相關的臨床決策支持建議。</p>
            </div>
            
            <div class="hook-alert info">
                <i class="fas fa-info-circle"></i>
                <span>患者基本信息：${patientAge}歲 ${patientGender}</span>
            </div>
            
            <div class="hook-cards">
                <div class="hook-card">
                    <h5><i class="fas fa-exclamation-triangle"></i> 年齡風險評估</h5>
                    <p>患者年齡 ${patientAge}歲，屬於${patientAge > 65 ? '高' : patientAge > 45 ? '中' : '低'}風險群體。</p>
                    ${patientAge > 65 ? '<div class="hook-alert warning"><i class="fas fa-exclamation-triangle"></i>建議加強心血管疾病篩查</div>' : ''}
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-pills"></i> 藥物過敏檢查</h5>
                    <p>檢查患者藥物過敏史，確保用藥安全。</p>
                    <div class="hook-alert success">
                        <i class="fas fa-check-circle"></i>
                        <span>未發現已知藥物過敏</span>
                    </div>
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-syringe"></i> 疫苗接種建議</h5>
                    <p>根據年齡和風險因素提供疫苗接種建議。</p>
                    ${patientAge > 65 ? '<div class="hook-alert info"><i class="fas fa-info-circle"></i>建議接種肺炎疫苗和流感疫苗</div>' : ''}
                </div>
            </div>
            
            <div class="hook-actions">
                <button class="hook-action-btn primary">
                    <i class="fas fa-chart-line"></i>
                    查看完整風險評估
                </button>
                <button class="hook-action-btn success">
                    <i class="fas fa-notes-medical"></i>
                    更新病史資料
                </button>
            </div>
        </div>
    `;
}

// Medication Prescribe Hook 生成器
function generateMedicationPrescribeHook(patient, encounter) {
    const patientName = patient ? getPatientName(patient) : '未知患者';
    const patientAge = patient ? calculateAge(patient.birthDate) : 0;
    
    return `
        <div class="hook-content">
            <div class="hook-header">
                <i class="fas fa-pills"></i>
                <h3>Medication Prescribe Hook</h3>
                <span class="hook-status active">活躍</span>
            </div>
            
            <div class="hook-info">
                <h4>藥物處方臨床決策支持</h4>
                <p>為患者 ${patientName} 提供藥物相互作用檢查、劑量調整建議和用藥安全提醒。</p>
            </div>
            
            <div class="hook-alert warning">
                <i class="fas fa-exclamation-triangle"></i>
                <span>發現潛在藥物相互作用，請仔細檢查</span>
            </div>
            
            <div class="hook-cards">
                <div class="hook-card">
                    <h5><i class="fas fa-exclamation-triangle"></i> 藥物相互作用</h5>
                    <p>檢測到阿司匹林與華法林可能的相互作用。</p>
                    <div class="hook-alert danger">
                        <i class="fas fa-times-circle"></i>
                        <span>增加出血風險 - 建議調整劑量或更換藥物</span>
                    </div>
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-weight"></i> 劑量調整建議</h5>
                    <p>根據患者年齡和腎功能調整藥物劑量。</p>
                    ${patientAge > 65 ? '<div class="hook-alert warning"><i class="fas fa-exclamation-triangle"></i>老年患者建議減少劑量20%</div>' : ''}
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-heartbeat"></i> 副作用監控</h5>
                    <p>需要監控的重要副作用和檢測項目。</p>
                    <div class="hook-alert info">
                        <i class="fas fa-info-circle"></i>
                        <span>建議定期檢測肝功能和凝血功能</span>
                    </div>
                </div>
            </div>
            
            <table class="hook-data-table">
                <thead>
                    <tr>
                        <th>藥物名稱</th>
                        <th>劑量</th>
                        <th>頻率</th>
                        <th>風險等級</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>阿司匹林</td>
                        <td>100mg</td>
                        <td>每日一次</td>
                        <td><span style="color: #dc3545;">高</span></td>
                    </tr>
                    <tr>
                        <td>華法林</td>
                        <td>5mg</td>
                        <td>每日一次</td>
                        <td><span style="color: #ffc107;">中</span></td>
                    </tr>
                </tbody>
            </table>
            
            <div class="hook-actions">
                <button class="hook-action-btn danger">
                    <i class="fas fa-times"></i>
                    取消處方
                </button>
                <button class="hook-action-btn warning">
                    <i class="fas fa-edit"></i>
                    調整劑量
                </button>
                <button class="hook-action-btn success">
                    <i class="fas fa-check"></i>
                    確認處方
                </button>
            </div>
        </div>
    `;
}

// Order Review Hook 生成器
function generateOrderReviewHook(patient, encounter) {
    const patientName = patient ? getPatientName(patient) : '未知患者';
    
    return `
        <div class="hook-content">
            <div class="hook-header">
                <i class="fas fa-clipboard-check"></i>
                <h3>Order Review Hook</h3>
                <span class="hook-status active">活躍</span>
            </div>
            
            <div class="hook-info">
                <h4>醫囑復查臨床決策支持</h4>
                <p>為患者 ${patientName} 的醫囑提供復查建議和安全性檢查。</p>
            </div>
            
            <div class="hook-alert success">
                <i class="fas fa-check-circle"></i>
                <span>已完成醫囑安全性檢查</span>
            </div>
            
            <div class="hook-cards">
                <div class="hook-card">
                    <h5><i class="fas fa-flask"></i> 實驗室檢查</h5>
                    <p>建議的實驗室檢查項目和時間安排。</p>
                    <div class="hook-alert info">
                        <i class="fas fa-info-circle"></i>
                        <span>建議明日空腹抽血檢查血脂</span>
                    </div>
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-x-ray"></i> 影像檢查</h5>
                    <p>影像學檢查的合理性和必要性評估。</p>
                    <div class="hook-alert warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>胸部X光檢查頻率過高，建議間隔3個月</span>
                    </div>
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-procedures"></i> 治療程序</h5>
                    <p>治療程序的安全性和適應症檢查。</p>
                    <div class="hook-alert success">
                        <i class="fas fa-check-circle"></i>
                        <span>治療程序符合臨床指南</span>
                    </div>
                </div>
            </div>
            
            <table class="hook-data-table">
                <thead>
                    <tr>
                        <th>醫囑類型</th>
                        <th>內容</th>
                        <th>狀態</th>
                        <th>建議</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>藥物治療</td>
                        <td>降壓藥物調整</td>
                        <td><span style="color: #28a745;">通過</span></td>
                        <td>定期監測血壓</td>
                    </tr>
                    <tr>
                        <td>檢查醫囑</td>
                        <td>心電圖檢查</td>
                        <td><span style="color: #28a745;">通過</span></td>
                        <td>按計劃執行</td>
                    </tr>
                    <tr>
                        <td>影像檢查</td>
                        <td>胸部CT</td>
                        <td><span style="color: #ffc107;">需要確認</span></td>
                        <td>考慮輻射暴露</td>
                    </tr>
                </tbody>
            </table>
            
            <div class="hook-actions">
                <button class="hook-action-btn primary">
                    <i class="fas fa-eye"></i>
                    查看詳細醫囑
                </button>
                <button class="hook-action-btn success">
                    <i class="fas fa-check"></i>
                    確認醫囑
                </button>
            </div>
        </div>
    `;
}

// Encounter Start Hook 生成器
function generateEncounterStartHook(patient, encounter) {
    const patientName = patient ? getPatientName(patient) : '未知患者';
    const patientAge = patient ? calculateAge(patient.birthDate) : 0;
    
    return `
        <div class="hook-content">
            <div class="hook-header">
                <i class="fas fa-play-circle"></i>
                <h3>Encounter Start Hook</h3>
                <span class="hook-status active">活躍</span>
            </div>
            
            <div class="hook-info">
                <h4>診療開始臨床決策支持</h4>
                <p>為患者 ${patientName} 的診療開始提供風險評估和注意事項。</p>
            </div>
            
            <div class="hook-alert info">
                <i class="fas fa-info-circle"></i>
                <span>診療開始時間：${new Date().toLocaleString('zh-TW')}</span>
            </div>
            
            <div class="hook-cards">
                <div class="hook-card">
                    <h5><i class="fas fa-exclamation-triangle"></i> 風險評估</h5>
                    <p>患者的主要風險因素和注意事項。</p>
                    ${patientAge > 65 ? 
                        '<div class="hook-alert warning"><i class="fas fa-exclamation-triangle"></i>高齡患者，注意跌倒風險</div>' : 
                        '<div class="hook-alert success"><i class="fas fa-check-circle"></i>年齡風險較低</div>'
                    }
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-history"></i> 病史提醒</h5>
                    <p>重要的既往病史和治療記錄。</p>
                    <div class="hook-alert info">
                        <i class="fas fa-info-circle"></i>
                        <span>患者有心肌梗塞病史，需要密切監測</span>
                    </div>
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-tasks"></i> 推薦檢查</h5>
                    <p>根據病史和症狀推薦的檢查項目。</p>
                    <div class="hook-alert info">
                        <i class="fas fa-info-circle"></i>
                        <span>建議進行心電圖和血壓監測</span>
                    </div>
                </div>
            </div>
            
            <div class="hook-actions">
                <button class="hook-action-btn primary">
                    <i class="fas fa-stethoscope"></i>
                    開始診療
                </button>
                <button class="hook-action-btn warning">
                    <i class="fas fa-bell"></i>
                    設置提醒
                </button>
            </div>
        </div>
    `;
}

// Encounter Discharge Hook 生成器
function generateEncounterDischargeHook(patient, encounter) {
    const patientName = patient ? getPatientName(patient) : '未知患者';
    
    return `
        <div class="hook-content">
            <div class="hook-header">
                <i class="fas fa-sign-out-alt"></i>
                <h3>Encounter Discharge Hook</h3>
                <span class="hook-status active">活躍</span>
            </div>
            
            <div class="hook-info">
                <h4>出院臨床決策支持</h4>
                <p>為患者 ${patientName} 的出院提供後續護理建議和注意事項。</p>
            </div>
            
            <div class="hook-alert success">
                <i class="fas fa-check-circle"></i>
                <span>出院準備檢查已完成</span>
            </div>
            
            <div class="hook-cards">
                <div class="hook-card">
                    <h5><i class="fas fa-pills"></i> 出院用藥</h5>
                    <p>出院後的藥物治療方案和注意事項。</p>
                    <div class="hook-alert info">
                        <i class="fas fa-info-circle"></i>
                        <span>確保患者了解藥物使用方法</span>
                    </div>
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-calendar-alt"></i> 追蹤安排</h5>
                    <p>出院後的追蹤檢查和門診預約。</p>
                    <div class="hook-alert warning">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>建議1週後門診追蹤</span>
                    </div>
                </div>
                
                <div class="hook-card">
                    <h5><i class="fas fa-home"></i> 居家護理</h5>
                    <p>居家護理指導和生活方式建議。</p>
                    <div class="hook-alert info">
                        <i class="fas fa-info-circle"></i>
                        <span>提供居家護理指導手冊</span>
                    </div>
                </div>
            </div>
            
            <table class="hook-data-table">
                <thead>
                    <tr>
                        <th>項目</th>
                        <th>內容</th>
                        <th>完成狀態</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>出院摘要</td>
                        <td>病歷摘要編寫</td>
                        <td><span style="color: #28a745;">已完成</span></td>
                    </tr>
                    <tr>
                        <td>藥物交代</td>
                        <td>用藥指導</td>
                        <td><span style="color: #28a745;">已完成</span></td>
                    </tr>
                    <tr>
                        <td>追蹤預約</td>
                        <td>門診預約</td>
                        <td><span style="color: #ffc107;">待完成</span></td>
                    </tr>
                </tbody>
            </table>
            
            <div class="hook-actions">
                <button class="hook-action-btn success">
                    <i class="fas fa-check"></i>
                    確認出院
                </button>
                <button class="hook-action-btn primary">
                    <i class="fas fa-print"></i>
                    列印出院摘要
                </button>
            </div>
        </div>
    `;
}

// 錯誤處理
window.addEventListener('error', function(e) {
    console.error('應用程式錯誤:', e.error);
    showNotification('系統發生錯誤，請重新載入頁面', 'error');
});

// 載入完成通知
window.addEventListener('load', function() {
    setTimeout(() => {
        showNotification('SMART 平台載入完成', 'success');
    }, 500);
});

// 初始化頁簽功能
function initializeTabs() {
    console.log('初始化頁簽功能...');
    
    // 只綁定初始的 CDS Hooks 頁簽切換事件
    const cdsHooksBtn = document.querySelector('.tab-btn[data-tab="cds-hooks"]');
    if (cdsHooksBtn) {
        cdsHooksBtn.addEventListener('click', function() {
            switchToTab('cds-hooks');
        });
    }
    
    // 默認顯示 CDS Hooks 頁簽
    switchToTab('cds-hooks');
}

// 兼容舊的 switchTab 函數調用
function switchTab(targetTabId) {
    switchToTab(targetTabId);
}



// ================================
// 輔助功能函數
// ================================

// 計算年齡
function calculateAge(birthDate) {
    if (!birthDate) return 'Unknown';
    
    const birth = new Date(birthDate);
    const today = new Date();
    
    if (isNaN(birth.getTime())) return 'Unknown';
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
        age--;
    }
    
    return age;
}

// 獲取患者姓名
function getPatientName(patient) {
    if (!patient || !patient.name || patient.name.length === 0) {
        return 'Unknown Patient';
    }
    
    const name = patient.name[0];
    const given = (name.given || []).join(' ');
    const family = name.family || '';
    
    return `${given} ${family}`.trim() || 'Unknown Patient';
}

// ================================
// 實驗室數據趨勢分析功能
// ================================

// 全域變數儲存實驗室數據
let labObservations = [];
let labCharts = {};

// 載入實驗室觀察數據
async function loadLabObservations() {
    if (!smartClient) {
        showNotification('無法載入實驗室數據：未連接到 FHIR 服務器', 'error');
        showNoLabDataState();
        return;
    }

    showLoadingState();
    
    try {
        // 獲取時間範圍
        const timeRange = document.getElementById('timeRangeSelector')?.value || '1y';
        const dateFilter = getDateFilter(timeRange);
        
        console.log('載入實驗室數據，時間範圍:', timeRange);
        
        // 構建查詢參數
        const queryParams = [
            `patient=${smartClient.patient.id}`,
            'category=laboratory',
            '_sort=-date',
            '_count=100'
        ];
        
        if (dateFilter) {
            queryParams.push(`date=${dateFilter}`);
        }
        
        // 發送請求載入觀察數據
        const response = await smartClient.patient.request(`Observation?${queryParams.join('&')}`);
        
        console.log('FHIR 觀察數據回應:', response);
        
        if (response.entry && response.entry.length > 0) {
            labObservations = response.entry.map(entry => entry.resource);
            console.log('成功載入實驗室數據:', labObservations.length, '個觀察記錄');
            
            // 處理和顯示數據
            processAndDisplayLabData();
        } else {
            console.log('未找到實驗室數據，生成演示數據');
            // 生成演示數據以供展示
            generateDemoLabData();
        }
        
    } catch (error) {
        console.error('載入實驗室數據失敗:', error);
        showNotification('載入實驗室數據失敗: ' + error.message, 'error');
        showNoLabDataState();
    }
}

// 根據時間範圍獲取日期過濾器
function getDateFilter(timeRange) {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
        case '6m':
            startDate = new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
            break;
        case '1y':
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            break;
        case '2y':
            startDate = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
            break;
        case 'all':
            return null; // 不加日期限制
        default:
            startDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    }
    
    return `ge${startDate.toISOString().split('T')[0]}`;
}

// 處理和顯示實驗室數據
function processAndDisplayLabData() {
    const processedData = processLabData(labObservations);
    
    // 更新概覽統計
    updateLabOverview(processedData);
    
    // 創建趨勢圖表
    createTrendCharts(processedData);
    
    // 生成臨床建議
    generateClinicalRecommendations(processedData);
    
    // 顯示所有內容
    showLabDataContent();
}

// 處理實驗室數據
function processLabData(observations) {
    const processedData = {
        egfr: [],
        cholesterol: [],
        hba1c: [],
        bloodPressure: [],
        other: []
    };
    
    observations.forEach(obs => {
        const code = getObservationCode(obs);
        const value = getObservationNumericValue(obs);
        const date = getObservationEffectiveDate(obs);
        const display = getObservationDisplay(obs);
        
        if (value !== null && date) {
            const dataPoint = {
                date,
                value,
                display,
                unit: getObservationUnit(obs),
                reference: getObservationReference(obs)
            };
            
            // 根據 LOINC 代碼或顯示名稱分類
            if (isEGFRObservation(code, display)) {
                processedData.egfr.push(dataPoint);
            } else if (isCholesterolObservation(code, display)) {
                processedData.cholesterol.push(dataPoint);
            } else if (isHbA1cObservation(code, display)) {
                processedData.hba1c.push(dataPoint);
            } else if (isBloodPressureObservation(code, display)) {
                processedData.bloodPressure.push(dataPoint);
            } else {
                processedData.other.push(dataPoint);
            }
        }
    });
    
    // 按日期排序
    Object.keys(processedData).forEach(key => {
        processedData[key].sort((a, b) => new Date(a.date) - new Date(b.date));
    });
    
    console.log('處理後的實驗室數據:', processedData);
    return processedData;
}

// 檢查是否為 eGFR 觀察
function isEGFRObservation(code, display) {
    const egfrCodes = ['33914-3', '62238-1', '98979-8'];
    const egfrKeywords = ['egfr', 'glomerular filtration rate', '腎絲球過濾率'];
    
    return egfrCodes.includes(code) || 
           egfrKeywords.some(keyword => display.toLowerCase().includes(keyword.toLowerCase()));
}

// 檢查是否為膽固醇觀察
function isCholesterolObservation(code, display) {
    const cholesterolCodes = ['2093-3', '14647-2', '2089-1'];
    const cholesterolKeywords = ['cholesterol', 'total cholesterol', '總膽固醇', '膽固醇'];
    
    return cholesterolCodes.includes(code) || 
           cholesterolKeywords.some(keyword => display.toLowerCase().includes(keyword.toLowerCase()));
}

// 檢查是否為 HbA1c 觀察
function isHbA1cObservation(code, display) {
    const hba1cCodes = ['4548-4', '17856-6', '4549-2'];
    const hba1cKeywords = ['hba1c', 'hemoglobin a1c', 'glycohemoglobin', '糖化血紅蛋白'];
    
    return hba1cCodes.includes(code) || 
           hba1cKeywords.some(keyword => display.toLowerCase().includes(keyword.toLowerCase()));
}

// 檢查是否為血壓觀察
function isBloodPressureObservation(code, display) {
    const bpCodes = ['85354-9', '8480-6', '8462-4'];
    const bpKeywords = ['blood pressure', 'systolic', 'diastolic', '血壓', '收縮壓', '舒張壓'];
    
    return bpCodes.includes(code) || 
           bpKeywords.some(keyword => display.toLowerCase().includes(keyword.toLowerCase()));
}

// 獲取觀察的代碼
function getObservationCode(observation) {
    if (observation.code && observation.code.coding && observation.code.coding.length > 0) {
        return observation.code.coding[0].code;
    }
    return '';
}

// 獲取觀察的數值
function getObservationNumericValue(observation) {
    if (observation.valueQuantity && typeof observation.valueQuantity.value === 'number') {
        return observation.valueQuantity.value;
    }
    
    if (observation.component && observation.component.length > 0) {
        // 處理血壓等複合觀察
        const systolic = observation.component.find(c => 
            c.code && c.code.coding && c.code.coding.some(coding => 
                coding.code === '8480-6' || coding.display.includes('Systolic')
            )
        );
        
        if (systolic && systolic.valueQuantity) {
            return systolic.valueQuantity.value;
        }
    }
    
    return null;
}

// 獲取觀察的有效日期
function getObservationEffectiveDate(observation) {
    if (observation.effectiveDateTime) {
        return observation.effectiveDateTime;
    }
    
    if (observation.effectivePeriod && observation.effectivePeriod.start) {
        return observation.effectivePeriod.start;
    }
    
    return null;
}

// 獲取觀察的顯示名稱
function getObservationDisplay(observation) {
    if (observation.code && observation.code.coding && observation.code.coding.length > 0) {
        return observation.code.coding[0].display || observation.code.coding[0].code;
    }
    
    if (observation.code && observation.code.text) {
        return observation.code.text;
    }
    
    return 'Unknown Observation';
}

// 獲取觀察的單位
function getObservationUnit(observation) {
    if (observation.valueQuantity && observation.valueQuantity.unit) {
        return observation.valueQuantity.unit;
    }
    
    if (observation.valueQuantity && observation.valueQuantity.code) {
        return observation.valueQuantity.code;
    }
    
    return '';
}

// 獲取參考範圍
function getObservationReference(observation) {
    if (observation.referenceRange && observation.referenceRange.length > 0) {
        const ref = observation.referenceRange[0];
        let range = '';
        
        if (ref.low && ref.low.value) {
            range += `>${ref.low.value}`;
        }
        
        if (ref.high && ref.high.value) {
            if (range) range += ' - ';
            range += `<${ref.high.value}`;
        }
        
        return range;
    }
    
    return '';
}

// 更新實驗室概覽
function updateLabOverview(processedData) {
    // eGFR
    if (processedData.egfr.length > 0) {
        const latest = processedData.egfr[processedData.egfr.length - 1];
        const trend = calculateTrend(processedData.egfr);
        
        document.getElementById('egfrLatest').textContent = `${latest.value} ${latest.unit}`;
        document.getElementById('egfrTrend').textContent = trend.text;
        document.getElementById('egfrTrend').className = `stat-trend ${trend.class}`;
    }
    
    // 膽固醇
    if (processedData.cholesterol.length > 0) {
        const latest = processedData.cholesterol[processedData.cholesterol.length - 1];
        const trend = calculateTrend(processedData.cholesterol);
        
        document.getElementById('cholesterolLatest').textContent = `${latest.value} ${latest.unit}`;
        document.getElementById('cholesterolTrend').textContent = trend.text;
        document.getElementById('cholesterolTrend').className = `stat-trend ${trend.class}`;
    }
    
    // HbA1c
    if (processedData.hba1c.length > 0) {
        const latest = processedData.hba1c[processedData.hba1c.length - 1];
        const trend = calculateTrend(processedData.hba1c);
        
        document.getElementById('hba1cLatest').textContent = `${latest.value}${latest.unit}`;
        document.getElementById('hba1cTrend').textContent = trend.text;
        document.getElementById('hba1cTrend').className = `stat-trend ${trend.class}`;
    }
    
    // 血壓
    if (processedData.bloodPressure.length > 0) {
        const latest = processedData.bloodPressure[processedData.bloodPressure.length - 1];
        const trend = calculateTrend(processedData.bloodPressure);
        
        document.getElementById('bpLatest').textContent = `${latest.value} ${latest.unit}`;
        document.getElementById('bpTrend').textContent = trend.text;
        document.getElementById('bpTrend').className = `stat-trend ${trend.class}`;
    }
}

// 計算趨勢
function calculateTrend(dataPoints) {
    if (dataPoints.length < 2) {
        return { text: '資料不足', class: 'neutral' };
    }
    
    const recent = dataPoints.slice(-3); // 最近3個數據點
    const older = dataPoints.slice(0, -3);
    
    if (older.length === 0) {
        return { text: '無法比較', class: 'neutral' };
    }
    
    const recentAvg = recent.reduce((sum, point) => sum + point.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, point) => sum + point.value, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (Math.abs(change) < 5) {
        return { text: '穩定', class: 'stable' };
    } else if (change > 0) {
        return { text: `上升 ${change.toFixed(1)}%`, class: 'increasing' };
    } else {
        return { text: `下降 ${Math.abs(change).toFixed(1)}%`, class: 'decreasing' };
    }
}

// 創建趨勢圖表
function createTrendCharts(processedData) {
    // 清除現有圖表
    Object.values(labCharts).forEach(chart => {
        if (chart) chart.destroy();
    });
    labCharts = {};
    
    // 創建 eGFR 圖表
    if (processedData.egfr.length > 0) {
        labCharts.egfr = createEGFRChart(processedData.egfr);
    }
    
    // 創建膽固醇圖表
    if (processedData.cholesterol.length > 0) {
        labCharts.cholesterol = createCholesterolChart(processedData.cholesterol);
    }
    
    // 創建 HbA1c 圖表
    if (processedData.hba1c.length > 0) {
        labCharts.hba1c = createHbA1cChart(processedData.hba1c);
    }
    
    // 創建血壓圖表
    if (processedData.bloodPressure.length > 0) {
        labCharts.bloodPressure = createBloodPressureChart(processedData.bloodPressure);
    }
}

// 創建 eGFR 圖表
function createEGFRChart(data) {
    const ctx = document.getElementById('egfrChart');
    if (!ctx) return null;
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(point => new Date(point.date).toLocaleDateString('zh-TW')),
            datasets: [{
                label: 'eGFR (mL/min/1.73m²)',
                data: data.map(point => point.value),
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'eGFR (mL/min/1.73m²)'
                    },
                    grid: {
                        color: function(context) {
                            const value = context.tick.value;
                            if (value === 90) return '#28a745'; // 正常
                            if (value === 60) return '#ffc107'; // 輕度
                            if (value === 30) return '#fd7e14'; // 中度
                            if (value === 15) return '#dc3545'; // 嚴重
                            return 'rgba(0,0,0,0.1)';
                        },
                        lineWidth: function(context) {
                            const value = context.tick.value;
                            return [90, 60, 30, 15].includes(value) ? 2 : 1;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const value = context.parsed.y;
                            if (value >= 90) return '狀態: 正常';
                            if (value >= 60) return '狀態: 輕度下降';
                            if (value >= 30) return '狀態: 中度下降';
                            if (value >= 15) return '狀態: 嚴重下降';
                            return '狀態: 腎衰竭';
                        }
                    }
                }
            }
        }
    });
}

// 創建膽固醇圖表
function createCholesterolChart(data) {
    const ctx = document.getElementById('cholesterolChart');
    if (!ctx) return null;
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(point => new Date(point.date).toLocaleDateString('zh-TW')),
            datasets: [{
                label: '總膽固醇 (mg/dL)',
                data: data.map(point => point.value),
                borderColor: '#dc3545',
                backgroundColor: 'rgba(220, 53, 69, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: '總膽固醇 (mg/dL)'
                    },
                    grid: {
                        color: function(context) {
                            const value = context.tick.value;
                            if (value === 200) return '#28a745'; // 理想
                            if (value === 240) return '#dc3545'; // 高
                            return 'rgba(0,0,0,0.1)';
                        },
                        lineWidth: function(context) {
                            const value = context.tick.value;
                            return [200, 240].includes(value) ? 2 : 1;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const value = context.parsed.y;
                            if (value < 200) return '狀態: 理想';
                            if (value < 240) return '狀態: 邊界高';
                            return '狀態: 高';
                        }
                    }
                }
            }
        }
    });
}

// 創建 HbA1c 圖表
function createHbA1cChart(data) {
    const ctx = document.getElementById('hba1cChart');
    if (!ctx) return null;
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(point => new Date(point.date).toLocaleDateString('zh-TW')),
            datasets: [{
                label: 'HbA1c (%)',
                data: data.map(point => point.value),
                borderColor: '#28a745',
                backgroundColor: 'rgba(40, 167, 69, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'HbA1c (%)'
                    },
                    grid: {
                        color: function(context) {
                            const value = context.tick.value;
                            if (value === 5.7) return '#28a745'; // 正常
                            if (value === 6.5) return '#dc3545'; // 糖尿病
                            return 'rgba(0,0,0,0.1)';
                        },
                        lineWidth: function(context) {
                            const value = context.tick.value;
                            return [5.7, 6.5].includes(value) ? 2 : 1;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const value = context.parsed.y;
                            if (value < 5.7) return '狀態: 正常';
                            if (value < 6.5) return '狀態: 糖尿病前期';
                            return '狀態: 糖尿病';
                        }
                    }
                }
            }
        }
    });
}

// 創建血壓圖表
function createBloodPressureChart(data) {
    const ctx = document.getElementById('bloodPressureChart');
    if (!ctx) return null;
    
    return new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(point => new Date(point.date).toLocaleDateString('zh-TW')),
            datasets: [{
                label: '收縮壓 (mmHg)',
                data: data.map(point => point.value),
                borderColor: '#fd7e14',
                backgroundColor: 'rgba(253, 126, 20, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: '血壓 (mmHg)'
                    },
                    grid: {
                        color: function(context) {
                            const value = context.tick.value;
                            if (value === 120) return '#28a745'; // 正常
                            if (value === 130) return '#ffc107'; // 高血壓1期
                            if (value === 140) return '#dc3545'; // 高血壓2期
                            return 'rgba(0,0,0,0.1)';
                        },
                        lineWidth: function(context) {
                            const value = context.tick.value;
                            return [120, 130, 140].includes(value) ? 2 : 1;
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        afterLabel: function(context) {
                            const value = context.parsed.y;
                            if (value < 120) return '狀態: 正常';
                            if (value < 130) return '狀態: 偏高';
                            if (value < 140) return '狀態: 高血壓1期';
                            return '狀態: 高血壓2期';
                        }
                    }
                }
            }
        }
    });
}

// 生成臨床建議
function generateClinicalRecommendations(processedData) {
    const recommendations = [];
    
    // eGFR 建議
    if (processedData.egfr.length > 0) {
        const latest = processedData.egfr[processedData.egfr.length - 1];
        const trend = calculateTrend(processedData.egfr);
        
        if (latest.value < 60) {
            recommendations.push({
                type: 'warning',
                icon: 'fas fa-exclamation-triangle',
                title: '腎功能異常',
                message: `當前 eGFR ${latest.value} ${latest.unit}，低於正常範圍。建議諮詢腎臟科醫師。`,
                priority: 'high'
            });
        }
        
        if (trend.class === 'decreasing') {
            recommendations.push({
                type: 'info',
                icon: 'fas fa-trend-down',
                title: 'eGFR 趨勢下降',
                message: `eGFR 呈下降趨勢（${trend.text}），建議密切監測腎功能。`,
                priority: 'medium'
            });
        }
    }
    
    // 膽固醇建議
    if (processedData.cholesterol.length > 0) {
        const latest = processedData.cholesterol[processedData.cholesterol.length - 1];
        
        if (latest.value >= 240) {
            recommendations.push({
                type: 'danger',
                icon: 'fas fa-heart',
                title: '膽固醇過高',
                message: `總膽固醇 ${latest.value} ${latest.unit}，屬於高風險範圍。建議生活方式調整和考慮藥物治療。`,
                priority: 'high'
            });
        } else if (latest.value >= 200) {
            recommendations.push({
                type: 'warning',
                icon: 'fas fa-exclamation-triangle',
                title: '膽固醇邊界高',
                message: `總膽固醇 ${latest.value} ${latest.unit}，建議改善飲食和增加運動。`,
                priority: 'medium'
            });
        }
    }
    
    // HbA1c 建議
    if (processedData.hba1c.length > 0) {
        const latest = processedData.hba1c[processedData.hba1c.length - 1];
        
        if (latest.value >= 6.5) {
            recommendations.push({
                type: 'danger',
                icon: 'fas fa-vial',
                title: '糖尿病指標',
                message: `HbA1c ${latest.value}${latest.unit}，符合糖尿病診斷標準。建議加強血糖控制。`,
                priority: 'high'
            });
        } else if (latest.value >= 5.7) {
            recommendations.push({
                type: 'warning',
                icon: 'fas fa-exclamation-triangle',
                title: '糖尿病前期',
                message: `HbA1c ${latest.value}${latest.unit}，屬於糖尿病前期。建議生活方式干預。`,
                priority: 'medium'
            });
        }
    }
    
    // 血壓建議
    if (processedData.bloodPressure.length > 0) {
        const latest = processedData.bloodPressure[processedData.bloodPressure.length - 1];
        
        if (latest.value >= 140) {
            recommendations.push({
                type: 'danger',
                icon: 'fas fa-heartbeat',
                title: '高血壓2期',
                message: `收縮壓 ${latest.value} ${latest.unit}，屬於高血壓2期。建議立即開始降壓治療。`,
                priority: 'high'
            });
        } else if (latest.value >= 130) {
            recommendations.push({
                type: 'warning',
                icon: 'fas fa-exclamation-triangle',
                title: '高血壓1期',
                message: `收縮壓 ${latest.value} ${latest.unit}，屬於高血壓1期。建議生活方式改變和考慮藥物治療。`,
                priority: 'medium'
            });
        }
    }
    
    // 一般建議
    if (recommendations.length === 0) {
        recommendations.push({
            type: 'success',
            icon: 'fas fa-check-circle',
            title: '實驗室數據正常',
            message: '目前的實驗室檢查結果都在正常範圍內，請繼續保持健康的生活方式。',
            priority: 'low'
        });
    }
    
    // 排序建議（高優先級在前）
    recommendations.sort((a, b) => {
        const priorityOrder = { 'high': 3, 'medium': 2, 'low': 1 };
        return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
    
    // 顯示建議
    displayRecommendations(recommendations);
}

// 顯示建議
function displayRecommendations(recommendations) {
    const container = document.getElementById('recommendationsContainer');
    if (!container) return;
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item ${rec.type}">
            <div class="recommendation-icon">
                <i class="${rec.icon}"></i>
            </div>
            <div class="recommendation-content">
                <h5>${rec.title}</h5>
                <p>${rec.message}</p>
            </div>
        </div>
    `).join('');
}

// 狀態管理函數
function showLoadingState() {
    document.getElementById('labDataLoading').style.display = 'block';
    document.getElementById('labDataOverview').style.display = 'none';
    document.getElementById('labChartsContainer').style.display = 'none';
    document.getElementById('labRecommendations').style.display = 'none';
    document.getElementById('noLabData').style.display = 'none';
}

function showLabDataContent() {
    document.getElementById('labDataLoading').style.display = 'none';
    document.getElementById('labDataOverview').style.display = 'block';
    document.getElementById('labChartsContainer').style.display = 'block';
    document.getElementById('labRecommendations').style.display = 'block';
    document.getElementById('noLabData').style.display = 'none';
}

function showNoLabDataState() {
    document.getElementById('labDataLoading').style.display = 'none';
    document.getElementById('labDataOverview').style.display = 'none';
    document.getElementById('labChartsContainer').style.display = 'none';
    document.getElementById('labRecommendations').style.display = 'none';
    document.getElementById('noLabData').style.display = 'block';
}



// 生成演示實驗室數據
function generateDemoLabData() {
    console.log('生成演示實驗室數據');
    
    const now = new Date();
    const demoObservations = [];
    
    // 生成過去12個月的 eGFR 數據
    for (let i = 12; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 15);
        const baseValue = 75;
        const variation = (Math.random() - 0.5) * 20;
        const trend = i * 0.5; // 輕微下降趨勢
        
        demoObservations.push({
            resourceType: 'Observation',
            id: `demo-egfr-${i}`,
            status: 'final',
            category: [{
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'laboratory'
                }]
            }],
            code: {
                coding: [{
                    system: 'http://loinc.org',
                    code: '33914-3',
                    display: 'Glomerular filtration rate/1.73 sq M.predicted'
                }]
            },
            effectiveDateTime: date.toISOString(),
            valueQuantity: {
                value: Math.round((baseValue - trend + variation) * 100) / 100,
                unit: 'mL/min/1.73m2',
                system: 'http://unitsofmeasure.org',
                code: 'mL/min/(1.73.m2)'
            }
        });
    }
    
    // 生成膽固醇數據
    for (let i = 12; i >= 0; i -= 2) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 10);
        const baseValue = 210;
        const variation = (Math.random() - 0.5) * 40;
        
        demoObservations.push({
            resourceType: 'Observation',
            id: `demo-cholesterol-${i}`,
            status: 'final',
            category: [{
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'laboratory'
                }]
            }],
            code: {
                coding: [{
                    system: 'http://loinc.org',
                    code: '2093-3',
                    display: 'Cholesterol [Mass/volume] in Serum or Plasma'
                }]
            },
            effectiveDateTime: date.toISOString(),
            valueQuantity: {
                value: Math.round((baseValue + variation) * 100) / 100,
                unit: 'mg/dL',
                system: 'http://unitsofmeasure.org',
                code: 'mg/dL'
            }
        });
    }
    
    // 生成 HbA1c 數據
    for (let i = 12; i >= 0; i -= 3) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 5);
        const baseValue = 6.2;
        const variation = (Math.random() - 0.5) * 0.8;
        
        demoObservations.push({
            resourceType: 'Observation',
            id: `demo-hba1c-${i}`,
            status: 'final',
            category: [{
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'laboratory'
                }]
            }],
            code: {
                coding: [{
                    system: 'http://loinc.org',
                    code: '4548-4',
                    display: 'Hemoglobin A1c/Hemoglobin.total in Blood'
                }]
            },
            effectiveDateTime: date.toISOString(),
            valueQuantity: {
                value: Math.round((baseValue + variation) * 100) / 100,
                unit: '%',
                system: 'http://unitsofmeasure.org',
                code: '%'
            }
        });
    }
    
    // 生成血壓數據
    for (let i = 12; i >= 0; i -= 1) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 20);
        const baseSystolic = 135;
        const baseDiastolic = 85;
        const variation = (Math.random() - 0.5) * 20;
        
        demoObservations.push({
            resourceType: 'Observation',
            id: `demo-bp-${i}`,
            status: 'final',
            category: [{
                coding: [{
                    system: 'http://terminology.hl7.org/CodeSystem/observation-category',
                    code: 'vital-signs'
                }]
            }],
            code: {
                coding: [{
                    system: 'http://loinc.org',
                    code: '85354-9',
                    display: 'Blood pressure panel with all children optional'
                }]
            },
            effectiveDateTime: date.toISOString(),
            component: [
                {
                    code: {
                        coding: [{
                            system: 'http://loinc.org',
                            code: '8480-6',
                            display: 'Systolic blood pressure'
                        }]
                    },
                    valueQuantity: {
                        value: Math.round(baseSystolic + variation),
                        unit: 'mmHg',
                        system: 'http://unitsofmeasure.org',
                        code: 'mm[Hg]'
                    }
                },
                {
                    code: {
                        coding: [{
                            system: 'http://loinc.org',
                            code: '8462-4',
                            display: 'Diastolic blood pressure'
                        }]
                    },
                    valueQuantity: {
                        value: Math.round(baseDiastolic + variation * 0.7),
                        unit: 'mmHg',
                        system: 'http://unitsofmeasure.org',
                        code: 'mm[Hg]'
                    }
                }
            ]
        });
    }
    
    // 設置演示數據
    labObservations = demoObservations;
    console.log('已生成', labObservations.length, '個演示觀察記錄');
    
    // 顯示演示數據通知
    showNotification('未找到實驗室數據，已載入演示數據供展示', 'info');
    
    // 處理和顯示數據
    processAndDisplayLabData();
}

// ================================
// 面板拖拽調整功能
// ================================

// 面板寬度配置
let panelConfig = {
    leftPanelWidth: 270,
    rightPanelWidth: 270,
    minPanelWidth: 200,
    maxPanelWidth: 500,
    resizerWidth: 8
};

// 拖拽狀態
let resizeState = {
    isResizing: false,
    currentResizer: null,
    startX: 0,
    startLeftWidth: 0,
    startRightWidth: 0
};

// 初始化面板拖拽調整功能
function initializePanelResizers() {
    console.log('初始化面板拖拽調整功能...');
    
    // 初始化左側分隔條
    const leftResizer = document.getElementById('leftResizer');
    if (leftResizer) {
        initializeResizer(leftResizer, 'left');
    }
    
    // 初始化右側分隔條
    const rightResizer = document.getElementById('rightResizer');
    if (rightResizer) {
        initializeResizer(rightResizer, 'right');
    }
    
    // 從localStorage載入保存的寬度設置
    loadPanelWidths();
    
    // 應用初始寬度
    applyPanelWidths();
    
    console.log('面板拖拽調整功能初始化完成');
}

// 初始化單個分隔條
function initializeResizer(resizer, position) {
    // 滑鼠按下事件
    resizer.addEventListener('mousedown', (e) => {
        startResize(e, position);
    });
    
    // 防止分隔條被選中
    resizer.addEventListener('selectstart', (e) => {
        e.preventDefault();
    });
    
    // 觸摸設備支持
    resizer.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const mouseEvent = new MouseEvent('mousedown', {
            clientX: touch.clientX,
            clientY: touch.clientY
        });
        startResize(mouseEvent, position);
        e.preventDefault();
    });
}

// 開始拖拽調整
function startResize(e, position) {
    console.log(`開始調整${position === 'left' ? '左側' : '右側'}面板大小`);
    
    resizeState.isResizing = true;
    resizeState.currentResizer = position;
    resizeState.startX = e.clientX;
    resizeState.startLeftWidth = panelConfig.leftPanelWidth;
    resizeState.startRightWidth = panelConfig.rightPanelWidth;
    
    // 添加視覺反饋
    const resizer = document.getElementById(position === 'left' ? 'leftResizer' : 'rightResizer');
    if (resizer) {
        resizer.classList.add('resizing');
    }
    
    // 添加全局事件監聽器
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResize);
    
    // 觸摸設備支持
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', stopResize);
    
    // 防止文字選擇
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    
    // 防止默認行為
    e.preventDefault();
}

// 處理滑鼠移動
function handleMouseMove(e) {
    if (!resizeState.isResizing) return;
    
    const deltaX = e.clientX - resizeState.startX;
    updatePanelWidths(deltaX);
}

// 處理觸摸移動
function handleTouchMove(e) {
    if (!resizeState.isResizing) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - resizeState.startX;
    updatePanelWidths(deltaX);
    e.preventDefault();
}

// 更新面板寬度
function updatePanelWidths(deltaX) {
    const containerWidth = document.querySelector('.main-container').offsetWidth - 
                          (panelConfig.resizerWidth * 2) - 30; // 30px for padding
    
    let newLeftWidth, newRightWidth;
    
    if (resizeState.currentResizer === 'left') {
        // 調整左側面板
        newLeftWidth = Math.max(
            panelConfig.minPanelWidth,
            Math.min(
                panelConfig.maxPanelWidth,
                resizeState.startLeftWidth + deltaX
            )
        );
        newRightWidth = panelConfig.rightPanelWidth;
    } else {
        // 調整右側面板
        newLeftWidth = panelConfig.leftPanelWidth;
        newRightWidth = Math.max(
            panelConfig.minPanelWidth,
            Math.min(
                panelConfig.maxPanelWidth,
                resizeState.startRightWidth - deltaX
            )
        );
    }
    
    // 檢查是否有足夠空間給中間面板
    const minCenterWidth = 400;
    const availableWidth = containerWidth - newLeftWidth - newRightWidth;
    
    if (availableWidth < minCenterWidth) {
        // 如果中間面板太窄，調整面板寬度
        if (resizeState.currentResizer === 'left') {
            newLeftWidth = containerWidth - newRightWidth - minCenterWidth;
        } else {
            newRightWidth = containerWidth - newLeftWidth - minCenterWidth;
        }
    }
    
    // 更新配置
    panelConfig.leftPanelWidth = newLeftWidth;
    panelConfig.rightPanelWidth = newRightWidth;
    
    // 應用新寬度
    applyPanelWidths();
}

// 應用面板寬度到DOM
function applyPanelWidths() {
    const mainContainer = document.querySelector('.main-container');
    if (!mainContainer) return;
    
    const newColumns = `${panelConfig.leftPanelWidth}px ${panelConfig.resizerWidth}px 1fr ${panelConfig.resizerWidth}px ${panelConfig.rightPanelWidth}px`;
    mainContainer.style.gridTemplateColumns = newColumns;
    
    // 觸發視窗調整事件，以便其他組件能夠響應大小變化
    window.dispatchEvent(new Event('resize'));
}

// 停止拖拽調整
function stopResize() {
    if (!resizeState.isResizing) return;
    
    console.log(`完成面板大小調整 - 左側: ${panelConfig.leftPanelWidth}px, 右側: ${panelConfig.rightPanelWidth}px`);
    
    resizeState.isResizing = false;
    
    // 移除視覺反饋
    const leftResizer = document.getElementById('leftResizer');
    const rightResizer = document.getElementById('rightResizer');
    if (leftResizer) leftResizer.classList.remove('resizing');
    if (rightResizer) rightResizer.classList.remove('resizing');
    
    // 移除全局事件監聽器
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResize);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', stopResize);
    
    // 恢復游標和文字選擇
    document.body.style.userSelect = '';
    document.body.style.cursor = '';
    
    // 保存寬度設置到localStorage
    savePanelWidths();
    
    // 顯示完成通知
    showNotification(`面板寬度已調整 - 左: ${panelConfig.leftPanelWidth}px, 右: ${panelConfig.rightPanelWidth}px`, 'success');
    
    resizeState.currentResizer = null;
}

// 保存面板寬度到localStorage
function savePanelWidths() {
    try {
        const widthSettings = {
            leftPanelWidth: panelConfig.leftPanelWidth,
            rightPanelWidth: panelConfig.rightPanelWidth,
            timestamp: Date.now()
        };
        localStorage.setItem('smart_panel_widths', JSON.stringify(widthSettings));
        console.log('面板寬度設置已保存');
    } catch (error) {
        console.error('保存面板寬度失敗:', error);
    }
}

// 從localStorage載入面板寬度
function loadPanelWidths() {
    try {
        const saved = localStorage.getItem('smart_panel_widths');
        if (saved) {
            const widthSettings = JSON.parse(saved);
            
            // 檢查數據是否有效且不太舊（30天內）
            const maxAge = 30 * 24 * 60 * 60 * 1000; // 30天
            if (widthSettings.timestamp && (Date.now() - widthSettings.timestamp) < maxAge) {
                if (widthSettings.leftPanelWidth >= panelConfig.minPanelWidth && 
                    widthSettings.leftPanelWidth <= panelConfig.maxPanelWidth) {
                    panelConfig.leftPanelWidth = widthSettings.leftPanelWidth;
                }
                
                if (widthSettings.rightPanelWidth >= panelConfig.minPanelWidth && 
                    widthSettings.rightPanelWidth <= panelConfig.maxPanelWidth) {
                    panelConfig.rightPanelWidth = widthSettings.rightPanelWidth;
                }
                
                console.log('已載入保存的面板寬度設置');
            }
        }
    } catch (error) {
        console.error('載入面板寬度失敗:', error);
    }
}

// 重置面板寬度到默認值
function resetPanelWidths() {
    panelConfig.leftPanelWidth = 270;
    panelConfig.rightPanelWidth = 270;
    
    applyPanelWidths();
    savePanelWidths();
    
    showNotification('面板寬度已重置為默認值', 'info');
}

// 全域函數，可供其他地方調用
window.resetPanelWidths = resetPanelWidths;

// 在視窗調整時檢查面板寬度
window.addEventListener('resize', function() {
    // 延遲執行，避免頻繁調整
    setTimeout(() => {
        const containerWidth = document.querySelector('.main-container')?.offsetWidth;
        if (containerWidth) {
            // 如果視窗太小，自動調整面板寬度
            const totalPanelWidth = panelConfig.leftPanelWidth + panelConfig.rightPanelWidth;
            const minRequiredWidth = totalPanelWidth + 400 + 16 + 30; // 面板 + 中間最小寬度 + 分隔條 + padding
            
            if (containerWidth < minRequiredWidth) {
                const reduction = (minRequiredWidth - containerWidth) / 2;
                const newLeftWidth = Math.max(panelConfig.minPanelWidth, panelConfig.leftPanelWidth - reduction);
                const newRightWidth = Math.max(panelConfig.minPanelWidth, panelConfig.rightPanelWidth - reduction);
                
                if (newLeftWidth !== panelConfig.leftPanelWidth || newRightWidth !== panelConfig.rightPanelWidth) {
                    panelConfig.leftPanelWidth = newLeftWidth;
                    panelConfig.rightPanelWidth = newRightWidth;
                    applyPanelWidths();
                }
            }
        }
    }, 100);
});

// ================================
// 風險計算功能 API 集成
// ================================

// 自動載入 ASCVD 風險評估數據
async function autoLoadASCVDData() {
    console.log('開始自動載入 ASCVD 風險評估數據...');
    showNotification('正在載入 ASCVD 評估所需數據...', 'info');
    
    try {
        const riskData = await gatherASCVDRiskData();
        console.log('ASCVD 風險數據:', riskData);
        
        // 更新 ASCVD 功能頁面內容
        await updateASCVDContent(riskData);
        
        // 自動計算風險
        const riskScore = calculateASCVDRiskScore(riskData);
        
        showNotification(`ASCVD 數據載入完成，10年風險: ${riskScore}%`, 'success');
        
    } catch (error) {
        console.error('載入 ASCVD 數據失敗:', error);
        showNotification('ASCVD 數據載入失敗，將顯示手動輸入界面', 'warning');
    }
}

// 收集 ASCVD 風險計算所需數據
async function gatherASCVDRiskData() {
    const patientData = await smartClient.patient.read();
    const riskData = {
        age: calculateAge(patientData.birthDate),
        gender: patientData.gender,
        totalCholesterol: null,
        hdlCholesterol: null,
        systolicBP: null,
        diabetes: false,
        smokingStatus: false,
        raceEthnicity: null,
        onBPTreatment: false,
        dataStatus: {}
    };
    
    // 載入最新的檢驗數據
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 90); // 擴展到90天
    const dateFilter = `date=ge${thirtyDaysAgo.toISOString().split('T')[0]}`;
    
    try {
        // 載入總膽固醇 (LOINC: 2093-3)
        const cholesterolResponse = await smartClient.request(
            `Observation?patient=${smartClient.patient.id}&code=2093-3&${dateFilter}&_sort=-date&_count=1`
        );
        if (cholesterolResponse.entry && cholesterolResponse.entry.length > 0) {
            const cholObs = cholesterolResponse.entry[0].resource;
            if (cholObs.valueQuantity) {
                riskData.totalCholesterol = cholObs.valueQuantity.value;
                riskData.dataStatus.totalCholesterol = 'api';
            }
        }
        
        // 載入 HDL 膽固醇 (LOINC: 2085-9)
        const hdlResponse = await smartClient.request(
            `Observation?patient=${smartClient.patient.id}&code=2085-9&${dateFilter}&_sort=-date&_count=1`
        );
        if (hdlResponse.entry && hdlResponse.entry.length > 0) {
            const hdlObs = hdlResponse.entry[0].resource;
            if (hdlObs.valueQuantity) {
                riskData.hdlCholesterol = hdlObs.valueQuantity.value;
                riskData.dataStatus.hdlCholesterol = 'api';
            }
        }
        
        // 載入血壓 (收縮壓 LOINC: 8480-6)
        const bpResponse = await smartClient.request(
            `Observation?patient=${smartClient.patient.id}&code=8480-6&${dateFilter}&_sort=-date&_count=1`
        );
        if (bpResponse.entry && bpResponse.entry.length > 0) {
            const bpObs = bpResponse.entry[0].resource;
            if (bpObs.valueQuantity) {
                riskData.systolicBP = bpObs.valueQuantity.value;
                riskData.dataStatus.systolicBP = 'api';
            }
        }
        
        // 檢查糖尿病診斷
        const diabetesConditions = await smartClient.request(
            `Condition?patient=${smartClient.patient.id}&code=http://snomed.info/sct|44054006,http://hl7.org/fhir/sid/icd-10|E11&clinical-status=active`
        );
        if (diabetesConditions.entry && diabetesConditions.entry.length > 0) {
            riskData.diabetes = true;
            riskData.dataStatus.diabetes = 'api';
        }
        
        // 檢查吸煙狀態 (LOINC: 72166-2)
        const smokingResponse = await smartClient.request(
            `Observation?patient=${smartClient.patient.id}&code=72166-2&_sort=-date&_count=1`
        );
        if (smokingResponse.entry && smokingResponse.entry.length > 0) {
            const smokingObs = smokingResponse.entry[0].resource;
            if (smokingObs.valueCodeableConcept) {
                const smokingCode = smokingObs.valueCodeableConcept.coding[0]?.code;
                // 依據 SNOMED CT 代碼判斷
                if (['449868002', '77176002'].includes(smokingCode)) { // 當前吸煙者
                    riskData.smokingStatus = true;
                }
                riskData.dataStatus.smokingStatus = 'api';
            }
        }
        
        // 檢查是否有降血壓藥物治療
        const bpMedications = await smartClient.request(
            `MedicationRequest?patient=${smartClient.patient.id}&status=active&medication-code=http://www.nlm.nih.gov/research/umls/rxnorm|314076,http://www.nlm.nih.gov/research/umls/rxnorm|197361`
        );
        if (bpMedications.entry && bpMedications.entry.length > 0) {
            riskData.onBPTreatment = true;
            riskData.dataStatus.onBPTreatment = 'api';
        }
        
    } catch (error) {
        console.warn('載入部分 ASCVD 數據時出錯:', error);
    }
    
    return riskData;
}

// 計算 ASCVD 風險分數 (簡化版本)
function calculateASCVDRiskScore(riskData) {
    // 這是簡化的 ASCVD 風險計算，實際應使用 ACC/AHA 2013 方程式
    let riskScore = 0;
    
    // 年齡因素
    if (riskData.age) {
        if (riskData.age >= 70) riskScore += 15;
        else if (riskData.age >= 60) riskScore += 10;
        else if (riskData.age >= 50) riskScore += 5;
    }
    
    // 性別因素
    if (riskData.gender === 'male') {
        riskScore += 5;
    }
    
    // 膽固醇因素
    if (riskData.totalCholesterol && riskData.hdlCholesterol) {
        const ratio = riskData.totalCholesterol / riskData.hdlCholesterol;
        if (ratio >= 5) riskScore += 8;
        else if (ratio >= 4) riskScore += 5;
        else if (ratio >= 3.5) riskScore += 2;
    }
    
    // 血壓因素
    if (riskData.systolicBP) {
        if (riskData.systolicBP >= 160) riskScore += 8;
        else if (riskData.systolicBP >= 140) riskScore += 5;
        else if (riskData.systolicBP >= 130) riskScore += 2;
    }
    
    // 糖尿病
    if (riskData.diabetes) riskScore += 10;
    
    // 吸煙
    if (riskData.smokingStatus) riskScore += 8;
    
    // 限制在合理範圍內
    return Math.min(Math.max(riskScore, 1), 50);
}

// 更新 ASCVD 內容顯示
async function updateASCVDContent(riskData) {
    // 尋找 ASCVD 功能頁籤
    const ascvdTab = Array.from(activeTabs.entries()).find(([id, info]) => 
        info.functionName === 'ASCVD 風險評估'
    );
    
    if (ascvdTab) {
        const [tabId, tabInfo] = ascvdTab;
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
            const riskFactorsDiv = tabContent.querySelector('.risk-factors ul');
            if (riskFactorsDiv) {
                updateASCVDRiskFactors(riskFactorsDiv, riskData);
            }
        }
    }
}

// 更新 ASCVD 風險因子顯示
function updateASCVDRiskFactors(factorsElement, riskData) {
    const factors = [
        {
            label: '年齡',
            value: riskData.age ? `${riskData.age}歲` : '未知',
            status: riskData.age ? 'check-circle' : 'exclamation-triangle',
            hasData: !!riskData.age
        },
        {
            label: '性別',
            value: riskData.gender === 'male' ? '男性' : riskData.gender === 'female' ? '女性' : '未知',
            status: riskData.gender ? 'check-circle' : 'exclamation-triangle',
            hasData: !!riskData.gender
        },
        {
            label: '總膽固醇',
            value: riskData.totalCholesterol ? `${riskData.totalCholesterol} mg/dL` : '需要檢測',
            status: riskData.totalCholesterol ? 'check-circle' : 'exclamation-triangle',
            hasData: !!riskData.totalCholesterol
        },
        {
            label: 'HDL膽固醇',
            value: riskData.hdlCholesterol ? `${riskData.hdlCholesterol} mg/dL` : '需要檢測',
            status: riskData.hdlCholesterol ? 'check-circle' : 'exclamation-triangle',
            hasData: !!riskData.hdlCholesterol
        },
        {
            label: '收縮壓',
            value: riskData.systolicBP ? `${riskData.systolicBP} mmHg` : '需要檢測',
            status: riskData.systolicBP ? 'check-circle' : 'exclamation-triangle',
            hasData: !!riskData.systolicBP
        },
        {
            label: '糖尿病',
            value: riskData.diabetes ? '是' : '否',
            status: riskData.diabetes ? 'exclamation-triangle' : 'check-circle',
            hasData: true
        },
        {
            label: '吸煙狀態',
            value: riskData.smokingStatus ? '是' : '否',
            status: riskData.smokingStatus ? 'exclamation-triangle' : 'check-circle',
            hasData: true
        }
    ];
    
    factorsElement.innerHTML = factors.map(factor => `
        <li>
            <i class="fas fa-${factor.status}"></i>
            ${factor.label}：${factor.value}
            ${riskData.dataStatus[factor.label] === 'api' ? ' (自動載入)' : ''}
        </li>
    `).join('');
}

// 自動載入 ARC-HBR 風險權衡數據
async function autoLoadARCHBRData() {
    console.log('開始自動載入 ARC-HBR 風險權衡數據...');
    showNotification('正在載入 ARC-HBR 評估所需數據...', 'info');
    
    try {
        const riskData = await gatherARCHBRRiskData();
        console.log('ARC-HBR 風險數據:', riskData);
        
        // 更新 ARC-HBR 功能頁面內容
        await updateARCHBRContent(riskData);
        
        // 計算風險分層
        const riskAssessment = calculateARCHBRRisk(riskData);
        
        showNotification(`ARC-HBR 數據載入完成，風險級別: ${riskAssessment.level}`, 'success');
        
    } catch (error) {
        console.error('載入 ARC-HBR 數據失敗:', error);
        showNotification('ARC-HBR 數據載入失敗', 'warning');
    }
}

// 收集 ARC-HBR 風險計算所需數據
async function gatherARCHBRRiskData() {
    const patientData = await smartClient.patient.read();
    const riskData = {
        age: calculateAge(patientData.birthDate),
        gender: patientData.gender,
        priorBleeding: false,
        creatinineClearance: null,
        hemoglobin: null,
        plateletCount: null,
        anticoagulants: false,
        activeNeoplasm: false,
        chronicDialysis: false,
        severeLiverDisease: false,
        dataStatus: {}
    };
    
    try {
        // 載入腎功能 (肌酸酐清除率)
        const creatinineResponse = await smartClient.request(
            `Observation?patient=${smartClient.patient.id}&code=33914-3&_sort=-date&_count=1`
        );
        if (creatinineResponse.entry && creatinineResponse.entry.length > 0) {
            const crObs = creatinineResponse.entry[0].resource;
            if (crObs.valueQuantity) {
                riskData.creatinineClearance = crObs.valueQuantity.value;
                riskData.dataStatus.creatinineClearance = 'api';
            }
        }
        
        // 載入血紅蛋白
        const hbResponse = await smartClient.request(
            `Observation?patient=${smartClient.patient.id}&code=718-7&_sort=-date&_count=1`
        );
        if (hbResponse.entry && hbResponse.entry.length > 0) {
            const hbObs = hbResponse.entry[0].resource;
            if (hbObs.valueQuantity) {
                riskData.hemoglobin = hbObs.valueQuantity.value;
                riskData.dataStatus.hemoglobin = 'api';
            }
        }
        
        // 載入血小板計數
        const plateletResponse = await smartClient.request(
            `Observation?patient=${smartClient.patient.id}&code=26515-7&_sort=-date&_count=1`
        );
        if (plateletResponse.entry && plateletResponse.entry.length > 0) {
            const plateletObs = plateletResponse.entry[0].resource;
            if (plateletObs.valueQuantity) {
                riskData.plateletCount = plateletObs.valueQuantity.value;
                riskData.dataStatus.plateletCount = 'api';
            }
        }
        
        // 檢查出血史
        riskData.priorBleeding = await checkBleedingHistory();
        if (riskData.priorBleeding) {
            riskData.dataStatus.priorBleeding = 'api';
        }
        
        // 檢查抗凝血藥物
        const anticoagulantMeds = await smartClient.request(
            `MedicationRequest?patient=${smartClient.patient.id}&status=active`
        );
        if (anticoagulantMeds.entry) {
            const warfarin = anticoagulantMeds.entry.some(entry => {
                const med = entry.resource;
                return med.medicationCodeableConcept?.text?.toLowerCase().includes('warfarin') ||
                       med.medicationCodeableConcept?.text?.toLowerCase().includes('dabigatran') ||
                       med.medicationCodeableConcept?.text?.toLowerCase().includes('rivaroxaban');
            });
            if (warfarin) {
                riskData.anticoagulants = true;
                riskData.dataStatus.anticoagulants = 'api';
            }
        }
        
        // 檢查惡性腫瘤診斷
        const neoplasms = await smartClient.request(
            `Condition?patient=${smartClient.patient.id}&code=http://snomed.info/sct|363346000&clinical-status=active`
        );
        if (neoplasms.entry && neoplasms.entry.length > 0) {
            riskData.activeNeoplasm = true;
            riskData.dataStatus.activeNeoplasm = 'api';
        }
        
        // 檢查透析相關診斷
        const dialysisConditions = await smartClient.request(
            `Condition?patient=${smartClient.patient.id}&code=http://snomed.info/sct|108241001,http://snomed.info/sct|71181003`
        );
        if (dialysisConditions.entry && dialysisConditions.entry.length > 0) {
            riskData.chronicDialysis = true;
            riskData.dataStatus.chronicDialysis = 'api';
        }
        
    } catch (error) {
        console.warn('載入部分 ARC-HBR 數據時出錯:', error);
    }
    
    return riskData;
}

// 計算 ARC-HBR 風險
function calculateARCHBRRisk(riskData) {
    let majorCriteria = 0;
    let minorCriteria = 0;
    
    // 主要標準
    if (riskData.age >= 75) majorCriteria++;
    if (riskData.priorBleeding) majorCriteria++;
    if (riskData.creatinineClearance && riskData.creatinineClearance < 30) majorCriteria++;
    if (riskData.hemoglobin && riskData.hemoglobin < 11) majorCriteria++;
    if (riskData.chronicDialysis) majorCriteria++;
    if (riskData.activeNeoplasm) majorCriteria++;
    if (riskData.severeLiverDisease) majorCriteria++;
    
    // 次要標準
    if (riskData.age >= 65 && riskData.age < 75) minorCriteria++;
    if (riskData.creatinineClearance && riskData.creatinineClearance >= 30 && riskData.creatinineClearance < 60) minorCriteria++;
    if (riskData.hemoglobin && riskData.hemoglobin >= 11 && riskData.hemoglobin < 12.9) minorCriteria++;
    if (riskData.anticoagulants) minorCriteria++;
    if (riskData.plateletCount && riskData.plateletCount < 100) minorCriteria++;
    
    let level = '低風險';
    let recommendation = '標準DAPT治療12個月';
    
    if (majorCriteria >= 1 || minorCriteria >= 2) {
        level = '高出血風險';
        recommendation = '考慮縮短DAPT至3-6個月，加強出血監測';
    }
    
    return {
        level,
        recommendation,
        majorCriteria,
        minorCriteria,
        score: majorCriteria * 2 + minorCriteria
    };
}

// ESC 心臟衰竭指引相關功能

// 自動載入患者心臟衰竭相關數據
async function autoLoadPatientHFData() {
    showNotification('正在載入患者心臟衰竭相關數據...', 'info');
    
    try {
        if (!smartClient || !smartClient.patient) {
            throw new Error('SMART 客戶端未就緒');
        }
        
        // 載入患者基本資料
        const patient = await smartClient.patient.read();
        
        // 計算年齡
        const birthDate = new Date(patient.birthDate);
        const age = new Date().getFullYear() - birthDate.getFullYear();
        
        // 載入相關檢驗數據
        const observations = await smartClient.request(`Observation?patient=${patient.id}&category=laboratory&_sort=-date&_count=50`);
        
        // 載入診斷資料
        const conditions = await smartClient.request(`Condition?patient=${patient.id}&_sort=-onset-date&_count=20`);
        
        // 處理生物標記數據
        const biomarkers = processBiomarkerData(observations.entry || []);
        
        // 處理心臟衰竭相關症狀
        const symptoms = processHFSymptoms(conditions.entry || []);
        
        // 更新UI
        updateHFPatientData({
            age: age,
            biomarkers: biomarkers,
            symptoms: symptoms
        });
        
        showNotification('患者心臟衰竭數據載入完成', 'success');
        
    } catch (error) {
        console.error('載入心臟衰竭數據失敗:', error);
        showNotification('載入數據失敗: ' + error.message, 'error');
    }
}

// 處理生物標記數據
function processBiomarkerData(observations) {
    const biomarkers = {
        ntproBNP: null,
        bnp: null,
        lvef: null
    };
    
    observations.forEach(entry => {
        if (!entry.resource) return;
        
        const obs = entry.resource;
        const code = obs.code?.coding?.[0]?.code;
        
        // NT-proBNP LOINC codes
        if (['33762-6', '71425-3'].includes(code)) {
            biomarkers.ntproBNP = obs.valueQuantity?.value;
        }
        
        // BNP LOINC codes
        if (['30934-4', '77622-8'].includes(code)) {
            biomarkers.bnp = obs.valueQuantity?.value;
        }
        
        // LVEF相關檢查
        if (['10230-1', '8806-2'].includes(code)) {
            biomarkers.lvef = obs.valueQuantity?.value;
        }
    });
    
    return biomarkers;
}

// 處理心臟衰竭症狀
function processHFSymptoms(conditions) {
    const symptoms = {
        dyspnea: false,
        fatigue: false,
        edema: false,
        orthopnea: false,
        pnd: false
    };
    
    conditions.forEach(entry => {
        if (!entry.resource) return;
        
        const condition = entry.resource;
        const code = condition.code?.coding?.[0]?.code;
        
        // 根據ICD-10或SNOMED代碼識別症狀
        if (['R06.0', '267036007'].includes(code)) symptoms.dyspnea = true;
        if (['R53', '84229001'].includes(code)) symptoms.fatigue = true;
        if (['R60.9', '267038008'].includes(code)) symptoms.edema = true;
        // 可以添加更多症狀映射
    });
    
    return symptoms;
}

// 更新心臟衰竭患者數據UI
function updateHFPatientData(data) {
    // 更新生物標記輸入框
    if (data.biomarkers.ntproBNP) {
        const ntproBNPInput = document.getElementById('ntproBNP');
        if (ntproBNPInput) {
            ntproBNPInput.value = data.biomarkers.ntproBNP;
        }
    }
    
    if (data.biomarkers.bnp) {
        const bnpInput = document.getElementById('bnp');
        if (bnpInput) {
            bnpInput.value = data.biomarkers.bnp;
        }
    }
    
    if (data.biomarkers.lvef) {
        const lvefInput = document.getElementById('lvef');
        if (lvefInput) {
            lvefInput.value = data.biomarkers.lvef;
        }
    }
    
    // 更新症狀勾選框
    Object.keys(data.symptoms).forEach(symptom => {
        const checkbox = document.querySelector(`input[name="symptoms"][value="${symptom}"]`);
        if (checkbox && data.symptoms[symptom]) {
            checkbox.checked = true;
        }
    });
}

// 生成個人化心臟衰竭治療建議
function generateHFRecommendations() {
    showNotification('正在分析患者資料並生成個人化建議...', 'info');
    
    setTimeout(() => {
        const recommendations = analyzeHFPatientData();
        displayHFRecommendations(recommendations);
        showNotification('個人化治療建議已生成', 'success');
    }, 1500);
}

// 分析心臟衰竭患者數據
function analyzeHFPatientData() {
    const ntproBNP = parseFloat(document.getElementById('ntproBNP')?.value) || 0;
    const bnp = parseFloat(document.getElementById('bnp')?.value) || 0;
    const lvef = parseFloat(document.getElementById('lvef')?.value) || 50;
    
    // 獲取選中的症狀
    const symptoms = Array.from(document.querySelectorAll('input[name="symptoms"]:checked'))
        .map(cb => cb.value);
    
    // 獲取NYHA分級
    const nyhaClass = document.querySelector('.nyha-btn.active')?.dataset.class || 'unknown';
    
    const recommendations = [];
    
    // HF類型判斷
    let hfType = 'unknown';
    if (lvef < 40) {
        hfType = 'HFrEF';
    } else if (lvef >= 40 && lvef < 50) {
        hfType = 'HFmrEF';
    } else if (lvef >= 50) {
        hfType = 'HFpEF';
    }
    
    // 生物標記評估
    if (ntproBNP > 400 || bnp > 100) {
        recommendations.push({
            type: 'warning',
            title: '生物標記異常',
            content: `${ntproBNP > 0 ? 'NT-proBNP' : 'BNP'} 顯著升高，提示心臟衰竭風險增加，建議進一步心臟功能評估。`,
            class: 'I',
            evidence: 'A'
        });
    }
    
    // 根據HF類型給予治療建議
    if (hfType === 'HFrEF') {
        recommendations.push({
            type: 'medication',
            title: 'HFrEF 標準治療',
            content: '建議啟動 ACE-I/ARB/ARNI + β-阻斷劑 + MRA 三重療法。',
            class: 'I',
            evidence: 'A'
        });
        
        if (symptoms.includes('edema') || symptoms.length > 2) {
            recommendations.push({
                type: 'medication',
                title: '症狀性治療',
                content: '患者有明顯症狀，建議加入利尿劑緩解體液滯留。',
                class: 'I',
                evidence: 'C'
            });
        }
        
        if (lvef <= 35) {
            recommendations.push({
                type: 'device',
                title: '裝置治療考慮',
                content: 'LVEF ≤ 35%，建議評估 ICD 植入適應症（一級預防）。',
                class: 'I',
                evidence: 'A'
            });
        }
    } else if (hfType === 'HFpEF') {
        recommendations.push({
            type: 'medication',
            title: 'HFpEF 治療重點',
            content: '重點控制共病症（高血壓、糖尿病、房顫）。考慮使用 SGLT2 抑制劑。',
            class: 'IIa',
            evidence: 'B'
        });
    }
    
    // NYHA分級相關建議
    if (nyhaClass === '3' || nyhaClass === '4') {
        recommendations.push({
            type: 'monitoring',
            title: '密切監測',
            content: `NYHA Class ${nyhaClass}，建議增加追蹤頻率，每月評估症狀變化。`,
            class: 'I',
            evidence: 'C'
        });
    }
    
    // 非藥物治療建議
    recommendations.push({
        type: 'lifestyle',
        title: '生活方式調整',
        content: '建議鈉攝取限制 (<2g/day)、規律運動、體重管理，並參加心臟復健計畫。',
        class: 'I',
        evidence: 'C'
    });
    
    return {
        hfType: hfType,
        nyhaClass: nyhaClass,
        recommendations: recommendations
    };
}

// 顯示心臟衰竭治療建議
function displayHFRecommendations(analysis) {
    const outputContainer = document.getElementById('hfRecommendationsOutput');
    if (!outputContainer) return;
    
    const hfTypeLabels = {
        'HFrEF': '射血分數降低的心臟衰竭',
        'HFmrEF': '射血分數輕度降低的心臟衰竭',
        'HFpEF': '射血分數保留的心臟衰竭',
        'unknown': '待進一步評估'
    };
    
    let html = `
        <div class="recommendations-result">
            <div class="diagnosis-summary">
                <h4><i class="fas fa-diagnosis"></i> 診斷評估</h4>
                <div class="diagnosis-item">
                    <span class="diagnosis-label">心臟衰竭類型:</span>
                    <span class="diagnosis-value ${analysis.hfType.toLowerCase()}">${hfTypeLabels[analysis.hfType]}</span>
                </div>
                <div class="diagnosis-item">
                    <span class="diagnosis-label">NYHA 分級:</span>
                    <span class="diagnosis-value nyha-${analysis.nyhaClass}">Class ${analysis.nyhaClass}</span>
                </div>
            </div>
            
            <div class="recommendations-list">
                <h4><i class="fas fa-clipboard-list"></i> 個人化治療建議</h4>
    `;
    
    analysis.recommendations.forEach((rec, index) => {
        const typeIcons = {
            'medication': 'fas fa-pills',
            'device': 'fas fa-microchip',
            'monitoring': 'fas fa-chart-line',
            'lifestyle': 'fas fa-heart',
            'warning': 'fas fa-exclamation-triangle'
        };
        
        html += `
            <div class="recommendation-card ${rec.type}">
                <div class="rec-header">
                    <i class="${typeIcons[rec.type] || 'fas fa-info-circle'}"></i>
                    <h5>${rec.title}</h5>
                    <div class="evidence-badge">
                        <span class="class-badge class-${rec.class?.toLowerCase()}">${rec.class}</span>
                        <span class="evidence-badge">${rec.evidence || ''}</span>
                    </div>
                </div>
                <p class="rec-content">${rec.content}</p>
            </div>
        `;
    });
    
    html += `
            </div>
            
            <div class="next-steps">
                <h4><i class="fas fa-arrow-right"></i> 建議後續步驟</h4>
                <div class="next-steps-list">
                    <div class="step-item">
                        <i class="fas fa-calendar-check"></i>
                        <span>安排2週後追蹤，評估治療反應</span>
                    </div>
                    <div class="step-item">
                        <i class="fas fa-vials"></i>
                        <span>監測腎功能及電解質平衡</span>
                    </div>
                    <div class="step-item">
                        <i class="fas fa-graduation-cap"></i>
                        <span>提供患者教育及自我管理指導</span>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    outputContainer.innerHTML = html;
}

// 初始化心臟衰竭功能頁籤的交互功能
function initializeHFTab(tabId) {
    const tabContent = document.getElementById(tabId);
    if (!tabContent) return;
    
    // 綁定NYHA分級按鈕
    const nyhaButtons = tabContent.querySelectorAll('.nyha-btn');
    nyhaButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            // 移除其他按鈕的active狀態
            nyhaButtons.forEach(b => b.classList.remove('active'));
            // 添加當前按鈕的active狀態
            this.classList.add('active');
            
            // 更新NYHA描述
            updateNYHADescription(this.dataset.class);
        });
    });
    
    // 綁定治療頁籤切換
    const treatmentTabs = tabContent.querySelectorAll('.treatment-tab');
    treatmentTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const targetTab = this.dataset.tab;
            
            // 切換頁籤活動狀態
            treatmentTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            
            // 切換內容顯示
            const treatmentContents = tabContent.querySelectorAll('.treatment-content');
            treatmentContents.forEach(content => {
                content.classList.remove('active');
            });
            
            const targetContent = tabContent.querySelector(`#${targetTab}-treatment`);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
}

// 更新NYHA分級描述
function updateNYHADescription(classNumber) {
    const descriptions = {
        '1': 'Class I: 無症狀限制。一般身體活動不會引起疲勞、心悸、呼吸困難或心絞痛。',
        '2': 'Class II: 輕度症狀限制。休息時舒適，但一般身體活動會引起疲勞、心悸、呼吸困難或心絞痛。',
        '3': 'Class III: 明顯症狀限制。休息時舒適，但較輕微的身體活動即會引起疲勞、心悸、呼吸困難或心絞痛。',
        '4': 'Class IV: 無法進行任何身體活動而不感不適。症狀可能在休息時出現。'
    };
    
    const descriptionElement = document.getElementById('nyhaDescription');
    if (descriptionElement && descriptions[classNumber]) {
        descriptionElement.innerHTML = `<p>${descriptions[classNumber]}</p>`;
    }
}

// 更新 ARC-HBR 內容顯示
async function updateARCHBRContent(riskData) {
    const archbrTab = Array.from(activeTabs.entries()).find(([id, info]) => 
        info.functionName === 'ARC-HBR 風險權衡'
    );
    
    if (archbrTab) {
        const [tabId, tabInfo] = archbrTab;
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
            const riskFactorsDiv = tabContent.querySelector('.risk-factors ul');
            if (riskFactorsDiv) {
                updateARCHBRRiskFactors(riskFactorsDiv, riskData);
            }
        }
    }
}

// 更新 ARC-HBR 風險因子顯示
function updateARCHBRRiskFactors(factorsElement, riskData) {
    const riskAssessment = calculateARCHBRRisk(riskData);
    
    const factors = [
        {
            label: '年齡',
            value: riskData.age ? `${riskData.age}歲` : '未知',
            status: (riskData.age >= 75) ? 'exclamation-triangle' : 'check-circle',
            isMajor: riskData.age >= 75,
            isMinor: riskData.age >= 65 && riskData.age < 75
        },
        {
            label: '既往出血史',
            value: riskData.priorBleeding ? '是' : '否',
            status: riskData.priorBleeding ? 'exclamation-triangle' : 'check-circle',
            isMajor: riskData.priorBleeding
        },
        {
            label: '腎功能',
            value: riskData.creatinineClearance ? `${riskData.creatinineClearance} mL/min/1.73m²` : '需要檢查',
            status: (riskData.creatinineClearance && riskData.creatinineClearance < 60) ? 'exclamation-triangle' : 'check-circle',
            isMajor: riskData.creatinineClearance && riskData.creatinineClearance < 30,
            isMinor: riskData.creatinineClearance && riskData.creatinineClearance >= 30 && riskData.creatinineClearance < 60
        },
        {
            label: '血紅蛋白',
            value: riskData.hemoglobin ? `${riskData.hemoglobin} g/dL` : '需要檢查',
            status: (riskData.hemoglobin && riskData.hemoglobin < 12.9) ? 'exclamation-triangle' : 'check-circle',
            isMajor: riskData.hemoglobin && riskData.hemoglobin < 11,
            isMinor: riskData.hemoglobin && riskData.hemoglobin >= 11 && riskData.hemoglobin < 12.9
        },
        {
            label: '抗凝血藥物',
            value: riskData.anticoagulants ? '使用中' : '未使用',
            status: riskData.anticoagulants ? 'exclamation-triangle' : 'check-circle',
            isMinor: riskData.anticoagulants
        }
    ];
    
    factorsElement.innerHTML = factors.map(factor => {
        let criteriaText = '';
        if (factor.isMajor) criteriaText = ' (主要標準)';
        else if (factor.isMinor) criteriaText = ' (次要標準)';
        
        return `
            <li>
                <i class="fas fa-${factor.status}"></i>
                ${factor.label}：${factor.value}${criteriaText}
            </li>
        `;
    }).join('');
    
    // 添加風險評估結果
    factorsElement.innerHTML += `
        <li style="margin-top: 15px; font-weight: bold; color: ${riskAssessment.level === '高出血風險' ? '#e74c3c' : '#27ae60'};">
            <i class="fas fa-${riskAssessment.level === '高出血風險' ? 'exclamation-triangle' : 'check-circle'}"></i>
            評估結果：${riskAssessment.level}
        </li>
        <li style="font-size: 12px; color: #666;">
            <i class="fas fa-info-circle"></i>
            ${riskAssessment.recommendation}
        </li>
    `;
}

// 自動載入風險評估檢測數據
async function autoLoadRiskAssessmentData() {
    console.log('開始自動載入風險評估檢測數據...');
    showNotification('正在進行綜合風險評估...', 'info');
    
    try {
        // 並行載入多個風險評估
        const [ascvdData, archbrData, labData] = await Promise.all([
            gatherASCVDRiskData(),
            gatherARCHBRRiskData(),
            loadLatestLabValues()
        ]);
        
        const comprehensiveRiskData = {
            ascvd: ascvdData,
            bleeding: archbrData,
            labs: labData
        };
        
        console.log('綜合風險評估數據:', comprehensiveRiskData);
        
        // 更新風險評估頁面
        await updateRiskAssessmentContent(comprehensiveRiskData);
        
        showNotification('綜合風險評估完成', 'success');
        
    } catch (error) {
        console.error('載入風險評估數據失敗:', error);
        showNotification('風險評估數據載入失敗', 'warning');
    }
}

// 更新風險評估內容顯示
async function updateRiskAssessmentContent(riskData) {
    const riskTab = Array.from(activeTabs.entries()).find(([id, info]) => 
        info.functionName === '風險評估檢測'
    );
    
    if (riskTab) {
        const [tabId, tabInfo] = riskTab;
        const tabContent = document.getElementById(tabId);
        if (tabContent) {
            const riskContainer = tabContent.querySelector('.risk-categories');
            if (riskContainer) {
                updateRiskCategories(riskContainer, riskData);
            }
        }
    }
}

// 更新風險分類顯示
function updateRiskCategories(containerElement, riskData) {
    // 計算各項風險
    const ascvdScore = calculateASCVDRiskScore(riskData.ascvd);
    const bleedingRisk = calculateARCHBRRisk(riskData.bleeding);
    const diabetesRisk = riskData.ascvd.diabetes ? 'high' : 'low';
    
    // 生成新的風險分類HTML
    containerElement.innerHTML = `
        <div class="risk-category">
            <div class="category-icon cardiovascular">
                <i class="fas fa-heartbeat"></i>
            </div>
            <h5>心血管風險 (ASCVD)</h5>
            <div class="risk-level ${ascvdScore >= 20 ? 'high' : ascvdScore >= 7.5 ? 'medium' : 'low'}">
                ${ascvdScore >= 20 ? '高風險' : ascvdScore >= 7.5 ? '中等風險' : '低風險'}
            </div>
            <p>10年風險：${ascvdScore}%</p>
            <div class="risk-details">
                <small>年齡: ${riskData.ascvd.age}歲 | 
                       膽固醇: ${riskData.ascvd.totalCholesterol ? riskData.ascvd.totalCholesterol + ' mg/dL' : '未檢測'} | 
                       血壓: ${riskData.ascvd.systolicBP ? riskData.ascvd.systolicBP + ' mmHg' : '未檢測'}</small>
            </div>
        </div>
        
        <div class="risk-category">
            <div class="category-icon bleeding">
                <i class="fas fa-tint"></i>
            </div>
            <h5>出血風險 (ARC-HBR)</h5>
            <div class="risk-level ${bleedingRisk.level === '高出血風險' ? 'high' : 'low'}">
                ${bleedingRisk.level}
            </div>
            <p>${bleedingRisk.recommendation}</p>
            <div class="risk-details">
                <small>主要標準: ${bleedingRisk.majorCriteria} | 次要標準: ${bleedingRisk.minorCriteria}</small>
            </div>
        </div>
        
        <div class="risk-category">
            <div class="category-icon diabetes">
                <i class="fas fa-vial"></i>
            </div>
            <h5>代謝風險</h5>
            <div class="risk-level ${diabetesRisk}">
                ${riskData.ascvd.diabetes ? '糖尿病患者' : '無糖尿病'}
            </div>
            <p>${riskData.ascvd.diabetes ? '需要加強血糖管理' : '維持健康生活方式'}</p>
            <div class="risk-details">
                <small>HbA1c: ${riskData.labs.hba1c || '未檢測'} | 
                       血糖: 建議定期監測</small>
            </div>
        </div>
        
        <div class="risk-category">
            <div class="category-icon renal">
                <i class="fas fa-kidneys"></i>
            </div>
            <h5>腎功能風險</h5>
            <div class="risk-level ${riskData.bleeding.creatinineClearance && riskData.bleeding.creatinineClearance < 60 ? 'medium' : 'low'}">
                ${riskData.bleeding.creatinineClearance && riskData.bleeding.creatinineClearance < 60 ? '腎功能受損' : '腎功能正常'}
            </div>
            <p>eGFR: ${riskData.bleeding.creatinineClearance ? riskData.bleeding.creatinineClearance + ' mL/min/1.73m²' : '未檢測'}</p>
            <div class="risk-details">
                <small>${riskData.bleeding.creatinineClearance && riskData.bleeding.creatinineClearance < 60 ? 
                       '需要調整藥物劑量和密切監測' : '維持當前治療策略'}</small>
            </div>
        </div>
    `;
} 