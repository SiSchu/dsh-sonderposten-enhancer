// ==UserScript==
// @name         DSH Dedicated Sonderposten Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Änderungen nur auf /dedicated-sonderposten
// @match        https://deinserverhost.de/dedicated-sonderposten
// @match        https://deinserverhost.de/dedicated-sonderposten/
// @match        https://deinserverhost.de/dedicated-sonderposten/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    const targetClass = 'dsh-card';

    const filterState = {
        cpuVendors: [],
        cpuModels: [],
        ramTypes: [],
        ramMin: 0,
        ramMax: Infinity,
        storageTypes: [],
        storageMin: 0,
        storageMax: Infinity,
        hasExtra: false,
        priceMin: 0,
        priceMax: Infinity
    };

    let allServers = [];
    let currentSortType = null;
    let currentSortAscending = true;

    function createFilterUI() {
        const filterPanel = document.createElement('div');
        filterPanel.className = 'filter-panel';
        filterPanel.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            margin: 10px 0;
            border-radius: 8px;
            overflow: hidden;
        `;

        const filterHeader = document.createElement('div');
        filterHeader.style.cssText = `
            background: rgba(255, 255, 255, 0.15);
            padding: 15px 20px;
            cursor: pointer;
            display: flex;
            justify-content: space-between;
            align-items: center;
            user-select: none;
        `;

        const filterTitle = document.createElement('h3');
        filterTitle.textContent = '🔍 Filter Servers';
        filterTitle.style.cssText = `
            margin: 0;
            color: white;
            font-size: 16px;
            font-weight: 600;
        `;

        const toggleIcon = document.createElement('span');
        toggleIcon.textContent = '▼';
        toggleIcon.style.cssText = `
            color: white;
            font-size: 14px;
            transition: transform 0.3s ease;
        `;

        filterHeader.appendChild(filterTitle);
        filterHeader.appendChild(toggleIcon);

        const filterContent = document.createElement('div');
        filterContent.className = 'filter-content';
        filterContent.style.cssText = `
            padding: 20px;
            display: none;
            flex-wrap: wrap;
            gap: 25px;
            align-items: flex-start;
            max-width: 100%;
            overflow-x: hidden;
            width: 100%;
            box-sizing: border-box;
        `;

        const cpuVendorGroup = createFilterGroup('CPU Vendor');
        const amdCheckbox = createCheckbox('AMD', 'cpu-vendor-amd');
        const intelCheckbox = createCheckbox('Intel', 'cpu-vendor-intel');

        amdCheckbox.addEventListener('change', () => {
            populateFilters(allServers);
            applyFilters();
        });
        intelCheckbox.addEventListener('change', () => {
            populateFilters(allServers);
            applyFilters();
        });

        cpuVendorGroup.appendChild(amdCheckbox);
        cpuVendorGroup.appendChild(intelCheckbox);

        const cpuModelGroup = createFilterGroup('CPU Model');
        const cpuModelDropdown = createDropdown('cpu-model-dropdown');
        cpuModelGroup.appendChild(cpuModelDropdown);

        const ramTypeGroup = createFilterGroup('RAM Type');
        const ddr3Checkbox = createCheckbox('DDR3', 'ram-type-ddr3');
        const ddr3EccCheckbox = createCheckbox('DDR3 ECC', 'ram-type-ddr3ecc');
        const ddr4Checkbox = createCheckbox('DDR4', 'ram-type-ddr4');
        const ddr5Checkbox = createCheckbox('DDR5', 'ram-type-ddr5');
        ramTypeGroup.appendChild(ddr3Checkbox);
        ramTypeGroup.appendChild(ddr3EccCheckbox);
        ramTypeGroup.appendChild(ddr4Checkbox);
        ramTypeGroup.appendChild(ddr5Checkbox);

        const ramAmountGroup = createFilterGroup('RAM Amount (GB)');
        const ramInputs = createNumberInputs('ram-min', 'ram-max', 'Min GB', 'Max GB');
        ramAmountGroup.appendChild(ramInputs);

        const storageTypeGroup = createFilterGroup('Storage Type');
        const hddCheckbox = createCheckbox('HDD', 'storage-type-hdd');
        const ssdCheckbox = createCheckbox('SSD', 'storage-type-ssd');
        const nvmeCheckbox = createCheckbox('NVME', 'storage-type-nvme');
        const nvmePcie4Checkbox = createCheckbox('NVME PCIE 4', 'storage-type-nvme-pcie4');
        storageTypeGroup.appendChild(hddCheckbox);
        storageTypeGroup.appendChild(ssdCheckbox);
        storageTypeGroup.appendChild(nvmeCheckbox);
        storageTypeGroup.appendChild(nvmePcie4Checkbox);

        const storageAmountGroup = createFilterGroup('Storage Amount (GB)');
        const storageInputs = createNumberInputs('storage-min', 'storage-max', 'Min GB', 'Max GB');
        storageAmountGroup.appendChild(storageInputs);

        const extraGroup = createFilterGroup('Extra Features');
        const extraCheckbox = createCheckbox('Has Extra Features', 'extra-features');
        extraGroup.appendChild(extraCheckbox);

        const priceGroup = createFilterGroup('Price (€)');
        const priceInputs = createNumberInputs('price-min', 'price-max', 'Min €', 'Max €');
        priceGroup.appendChild(priceInputs);

        const clearButton = document.createElement('button');
        clearButton.textContent = 'Clear All Filters';
        clearButton.style.cssText = `
            background: #dc3545;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-left: auto;
            margin-top: 20px;
            align-self: flex-end;
        `;
        clearButton.addEventListener('click', clearAllFilters);

        filterContent.appendChild(cpuVendorGroup);
        filterContent.appendChild(cpuModelGroup);
        filterContent.appendChild(ramTypeGroup);
        filterContent.appendChild(ramAmountGroup);
        filterContent.appendChild(storageTypeGroup);
        filterContent.appendChild(storageAmountGroup);
        filterContent.appendChild(extraGroup);
        filterContent.appendChild(priceGroup);
        filterContent.appendChild(clearButton);

        let isExpanded = false;
        filterHeader.addEventListener('click', () => {
            isExpanded = !isExpanded;
            if (isExpanded) {
                filterContent.style.display = 'flex';
                toggleIcon.textContent = '▲';
                toggleIcon.style.transform = 'rotate(0deg)';
            } else {
                filterContent.style.display = 'none';
                toggleIcon.textContent = '▼';
                toggleIcon.style.transform = 'rotate(0deg)';
            }
        });

        filterPanel.appendChild(filterHeader);
        filterPanel.appendChild(filterContent);

        return filterPanel;
    }

    // Creates a filter group container with title
    function createFilterGroup(title) {
        const group = document.createElement('div');
        group.className = 'filter-group';
        group.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
            min-width: 160px;
            max-width: 220px;
            flex: 0 0 auto;
            width: auto;
            margin-bottom: 10px;
        `;

        const label = document.createElement('div');
        label.className = 'filter-label';
        label.textContent = title;
        label.style.cssText = `
            font-weight: bold;
            color: white;
            margin-bottom: 5px;
        `;

        group.appendChild(label);
        return group;
    }

    // Creates a checkbox input with label
    function createCheckbox(text, id) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            align-items: center;
            gap: 8px;
        `;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = id;
        checkbox.style.cssText = `
            margin: 0;
        `;

        const label = document.createElement('label');
        label.htmlFor = id;
        label.textContent = text;
        label.style.cssText = `
            color: white;
            cursor: pointer;
            margin: 0;
        `;

        container.appendChild(checkbox);
        container.appendChild(label);

        checkbox.addEventListener('change', applyFilters);

        return container;
    }

    // Creates a dropdown button with menu
    function createDropdown(id) {
        const container = document.createElement('div');
        container.style.cssText = `
            position: relative;
        `;

        const button = document.createElement('button');
        button.id = id;
        button.textContent = 'Select CPU Models ▼';
        button.style.cssText = `
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 8px 12px;
            border-radius: 4px;
            cursor: pointer;
            width: 100%;
            text-align: left;
        `;

        const dropdown = document.createElement('div');
        dropdown.className = 'dropdown-menu';
        dropdown.style.cssText = `
            position: absolute;
            top: 100%;
            left: 0;
            right: 0;
            background: rgba(0, 0, 0, 0.9);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            max-height: 200px;
            overflow-y: auto;
            z-index: 1000;
            display: none;
        `;

        button.addEventListener('click', () => {
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        container.appendChild(button);
        container.appendChild(dropdown);

        return container;
    }

    // Creates min/max number input fields
    function createNumberInputs(minInputId, maxInputId, minLabel, maxLabel) {
        const container = document.createElement('div');
        container.style.cssText = `
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;

        const inputsContainer = document.createElement('div');
        inputsContainer.style.cssText = `
            display: flex;
            gap: 15px;
            align-items: center;
            justify-content: space-between;
        `;

        const minLabelElement = document.createElement('span');
        minLabelElement.textContent = 'Min';
        minLabelElement.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            font-weight: 500;
        `;

        const maxLabelElement = document.createElement('span');
        maxLabelElement.textContent = 'Max';
        maxLabelElement.style.cssText = `
            color: rgba(255, 255, 255, 0.7);
            font-size: 12px;
            font-weight: 500;
        `;

        const inputWrapper = document.createElement('div');
        inputWrapper.style.cssText = `
            display: flex;
            gap: 15px;
            align-items: center;
            flex: 1;
            justify-content: center;
        `;

        const minInput = document.createElement('input');
        minInput.type = 'number';
        minInput.id = minInputId;
        minInput.placeholder = minLabel;
        minInput.style.cssText = `
            width: 70px;
            padding: 6px 8px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border-radius: 4px;
            font-size: 14px;
        `;

        const maxInput = document.createElement('input');
        maxInput.type = 'number';
        maxInput.id = maxInputId;
        maxInput.placeholder = maxLabel;
        maxInput.style.cssText = `
            width: 70px;
            padding: 6px 8px;
            border: 1px solid rgba(255, 255, 255, 0.3);
            background: rgba(255, 255, 255, 0.1);
            color: white;
            border-radius: 4px;
            font-size: 14px;
        `;

        minInput.addEventListener('input', applyFilters);
        minInput.addEventListener('blur', () => {
            const value = parseFloat(minInput.value);
            const placeholder = minInput.placeholder;
            const minValue = parseFloat(placeholder.split(' ')[0]);
            if (!isNaN(value) && !isNaN(minValue) && value < minValue) {
                minInput.value = minValue;
            }
        });

        maxInput.addEventListener('input', applyFilters);
        maxInput.addEventListener('blur', () => {
            const value = parseFloat(maxInput.value);
            const placeholder = maxInput.placeholder;
            const maxValue = parseFloat(placeholder.split(' ')[0]);
            if (!isNaN(value) && !isNaN(maxValue) && value > maxValue) {
                maxInput.value = maxValue;
            }
        });

        inputWrapper.appendChild(minInput);
        inputWrapper.appendChild(maxInput);

        inputsContainer.appendChild(minLabelElement);
        inputsContainer.appendChild(inputWrapper);
        inputsContainer.appendChild(maxLabelElement);

        container.appendChild(inputsContainer);

        return container;
    }


    // Populates filter dropdowns with server data
    function populateFilters(servers) {
        allServers = servers;

        const cpuModels = {};
        const selectedVendors = [];
        if (document.getElementById('cpu-vendor-amd')?.checked) selectedVendors.push('AMD');
        if (document.getElementById('cpu-vendor-intel')?.checked) selectedVendors.push('Intel');

        const serversToShow = selectedVendors.length > 0
            ? servers.filter(s => selectedVendors.includes(s.cpuVendor))
            : servers;

        serversToShow.forEach(server => {
            if (server.cpuModel && server.cpuModel.trim()) {
                cpuModels[server.cpuModel] = (cpuModels[server.cpuModel] || 0) + 1;
            }
        });

        const buttonElement = document.querySelector('#cpu-model-dropdown');
        let dropdown = null;
        if (buttonElement && buttonElement.parentElement) {
            dropdown = buttonElement.parentElement.querySelector('.dropdown-menu');
        }
        if (dropdown) {
            dropdown.innerHTML = '';
            Object.entries(cpuModels).forEach(([model, count]) => {
                const item = document.createElement('div');
                item.style.cssText = `
                    padding: 8px 12px;
                    color: white;
                    cursor: pointer;
                    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                `;

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.checked = false;
                checkbox.addEventListener('change', applyFilters);

                const label = document.createElement('span');
                label.textContent = `${model} (${count})`;

                item.appendChild(checkbox);
                item.appendChild(label);

                item.addEventListener('click', (e) => {
                    if (e.target !== checkbox) {
                        checkbox.checked = !checkbox.checked;
                        applyFilters();
                    }
                });

                dropdown.appendChild(item);
            });
        }

        const ramMin = Math.min(...servers.map(s => s.totalRamGB));
        const ramMax = Math.max(...servers.map(s => s.totalRamGB));
        const storageMin = Math.min(...servers.map(s => s.totalStorageGB));
        const storageMax = Math.max(...servers.map(s => s.totalStorageGB));
        const priceMin = Math.min(...servers.map(s => s.priceNumeric));
        const priceMax = Math.max(...servers.map(s => s.priceNumeric));

        const ramMinInput = document.getElementById('ram-min');
        const ramMaxInput = document.getElementById('ram-max');
        const storageMinInput = document.getElementById('storage-min');
        const storageMaxInput = document.getElementById('storage-max');
        const priceMinInput = document.getElementById('price-min');
        const priceMaxInput = document.getElementById('price-max');

        if (ramMinInput) ramMinInput.placeholder = `${ramMin} GB`;
        if (ramMaxInput) ramMaxInput.placeholder = `${ramMax} GB`;
        if (storageMinInput) storageMinInput.placeholder = `${storageMin} GB`;
        if (storageMaxInput) storageMaxInput.placeholder = `${storageMax} GB`;
        if (priceMinInput) priceMinInput.placeholder = `${priceMin} €`;
        if (priceMaxInput) priceMaxInput.placeholder = `${priceMax} €`;
    }


    function applyFilters() {
        const cpuVendors = [];
        if (document.getElementById('cpu-vendor-amd')?.checked) cpuVendors.push('AMD');
        if (document.getElementById('cpu-vendor-intel')?.checked) cpuVendors.push('Intel');

        const cpuModels = [];
        const buttonElement = document.querySelector('#cpu-model-dropdown');
        if (buttonElement && buttonElement.parentElement) {
            const cpuModelCheckboxes = buttonElement.parentElement.querySelectorAll('.dropdown-menu input[type="checkbox"]:checked');
            cpuModelCheckboxes.forEach(checkbox => {
                const model = checkbox.nextElementSibling.textContent.split(' (')[0];
                cpuModels.push(model);
            });
        }

        const ramTypes = [];
        if (document.getElementById('ram-type-ddr3')?.checked) ramTypes.push('DDR3');
        if (document.getElementById('ram-type-ddr3ecc')?.checked) ramTypes.push('DDR3 ECC');
        if (document.getElementById('ram-type-ddr4')?.checked) ramTypes.push('DDR4');
        if (document.getElementById('ram-type-ddr5')?.checked) ramTypes.push('DDR5');

        const storageTypes = [];
        if (document.getElementById('storage-type-hdd')?.checked) storageTypes.push('HDD');
        if (document.getElementById('storage-type-ssd')?.checked) storageTypes.push('SSD');
        if (document.getElementById('storage-type-nvme')?.checked) storageTypes.push('NVME');
        if (document.getElementById('storage-type-nvme-pcie4')?.checked) storageTypes.push('NVME PCIE 4');

        const ramMin = parseFloat(document.getElementById('ram-min')?.value) || 0;
        const ramMax = parseFloat(document.getElementById('ram-max')?.value) || Infinity;
        const storageMin = parseFloat(document.getElementById('storage-min')?.value) || 0;
        const storageMax = parseFloat(document.getElementById('storage-max')?.value) || Infinity;
        const priceMin = parseFloat(document.getElementById('price-min')?.value) || 0;
        const priceMax = parseFloat(document.getElementById('price-max')?.value) || Infinity;
        const hasExtra = document.getElementById('extra-features')?.checked || false;
        let visibleCount = 0;
        allServers.forEach(server => {
            let visible = true;

            if (cpuVendors.length > 0 && !cpuVendors.includes(server.cpuVendor)) {
                visible = false;
            }

            if (cpuModels.length > 0 && !cpuModels.includes(server.cpuModel)) {
                visible = false;
            }

            if (ramTypes.length > 0 && !ramTypes.includes(server.ramDDRType)) {
                visible = false;
            }

            if (server.totalRamGB < ramMin || server.totalRamGB > ramMax) {
                visible = false;
            }

            if (storageTypes.length > 0) {
                const hasExactMatch = storageTypes.every(type =>
                    server.storageTypes.includes(type)
                ) && storageTypes.length === server.storageTypes.length;

                if (!hasExactMatch) {
                    visible = false;
                }
            }

            if (server.totalStorageGB < storageMin || server.totalStorageGB > storageMax) {
                visible = false;
            }

            if (hasExtra && !server.hasExtra) {
                visible = false;
            }

            if (server.priceNumeric < priceMin || server.priceNumeric > priceMax) {
                visible = false;
            }

            server.element.style.display = visible ? 'block' : 'none';
            if (visible) visibleCount++;
        });

        showNoResultsMessage(visibleCount === 0);

        if (currentSortType && visibleCount > 0) {
            applyCurrentSort();
        }
    }

    function applyCurrentSort() {
        if (!currentSortType) return;

        const visibleServers = allServers.filter(server =>
            server.element.style.display !== 'none'
        );

        if (visibleServers.length === 0) return;

        visibleServers.sort((a, b) => {
            let valueA, valueB;

            switch(currentSortType) {
                case 'CPU':
                    valueA = a.cpu;
                    valueB = b.cpu;
                    break;
                case 'RAM':
                    if (a.totalRamGB !== b.totalRamGB) {
                        return currentSortAscending ? a.totalRamGB - b.totalRamGB : b.totalRamGB - a.totalRamGB;
                    }

                    const ramPriorityA = a.ramDDRType === 'DDR3' ? 1 :
                                       a.ramDDRType === 'DDR3 ECC' ? 2 :
                                       a.ramDDRType === 'DDR4' ? 4 :
                                       a.ramDDRType === 'DDR5' ? 5 : 4;
                    const ramPriorityB = b.ramDDRType === 'DDR3' ? 1 :
                                       b.ramDDRType === 'DDR3 ECC' ? 2 :
                                       b.ramDDRType === 'DDR4' ? 4 :
                                       b.ramDDRType === 'DDR5' ? 5 : 4;

                    if (ramPriorityA !== ramPriorityB) {
                        return currentSortAscending ? ramPriorityA - ramPriorityB : ramPriorityB - ramPriorityA;
                    }

                    return a.priceNumeric - b.priceNumeric;
                case 'Storage':
                    if (a.totalStorageGB !== b.totalStorageGB) {
                        return currentSortAscending ? a.totalStorageGB - b.totalStorageGB : b.totalStorageGB - a.totalStorageGB;
                    }

                    const storagePriorityA = a.storageType === 'HDD' ? 1 :
                                           a.storageType === 'SSD' ? 2 :
                                           a.storageType === 'NVME' ? 3 :
                                           a.storageType === 'NVME PCIE 4' ? 4 : 0;
                    const storagePriorityB = b.storageType === 'HDD' ? 1 :
                                           b.storageType === 'SSD' ? 2 :
                                           b.storageType === 'NVME' ? 3 :
                                           b.storageType === 'NVME PCIE 4' ? 4 : 0;

                    if (storagePriorityA !== storagePriorityB) {
                        return currentSortAscending ? storagePriorityA - storagePriorityB : storagePriorityB - storagePriorityA;
                    }

                    return a.priceNumeric - b.priceNumeric;
                case 'Extra':
                    valueA = a.extra;
                    valueB = b.extra;
                    break;
                case 'Preis pro Monat':
                    return currentSortAscending ? a.priceNumeric - b.priceNumeric : b.priceNumeric - a.priceNumeric;
                default:
                    return 0;
            }

            if (valueA < valueB) return currentSortAscending ? -1 : 1;
            if (valueA > valueB) return currentSortAscending ? 1 : -1;
            return 0;
        });

        const containerDiv = document.querySelector('#SPArea main section div');
        if (containerDiv) {
            visibleServers.forEach(server => {
                containerDiv.appendChild(server.element);
            });
        }
    }

    function showNoResultsMessage(show) {
        let noResultsMsg = document.getElementById('no-results-message');
        if (!noResultsMsg) {
            noResultsMsg = document.createElement('div');
            noResultsMsg.id = 'no-results-message';
            noResultsMsg.textContent = 'No servers match the current filters';
            noResultsMsg.style.cssText = `
                text-align: center;
                padding: 40px;
                color: white;
                font-size: 18px;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 8px;
                margin: 20px 0;
            `;

            const containerDiv = document.querySelector('#SPArea main section div');
            if (containerDiv && containerDiv.children.length > 2) {
                containerDiv.insertBefore(noResultsMsg, containerDiv.children[2]);
            }
        }
        noResultsMsg.style.display = show ? 'block' : 'none';
    }

    function clearAllFilters() {
        document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

        const ramMin = document.getElementById('ram-min');
        const ramMax = document.getElementById('ram-max');
        const storageMin = document.getElementById('storage-min');
        const storageMax = document.getElementById('storage-max');
        const priceMin = document.getElementById('price-min');
        const priceMax = document.getElementById('price-max');

        if (ramMin && ramMax) {
            ramMin.value = ramMin.min;
            ramMax.value = ramMax.max;
        }
        if (storageMin && storageMax) {
            storageMin.value = storageMin.min;
            storageMax.value = storageMax.max;
        }
        if (priceMin && priceMax) {
            priceMin.value = priceMin.min;
            priceMax.value = priceMax.max;
        }

        allServers.forEach(server => {
            server.element.style.display = 'block';
        });

        showNoResultsMessage(false);
    }

    // Sorts servers by specified criteria
    function sortBy(type, ascending) {
        currentSortType = type;
        currentSortAscending = ascending;

        const allServers = getAllServers();

        allServers.sort((a, b) => {
            let valueA, valueB;

            switch(type) {
                case 'CPU':
                    valueA = a.cpu;
                    valueB = b.cpu;
                    break;
                case 'RAM':
                    if (a.totalRamGB !== b.totalRamGB) {
                        return ascending ? a.totalRamGB - b.totalRamGB : b.totalRamGB - a.totalRamGB;
                    }

                    const ddrPriority = { 'DDR3': 1, 'DDR3 ECC': 2, 'DDR4': 4, 'DDR5': 5 };
                    const ramPriorityA = ddrPriority[a.ramDDRType] || 4;
                    const ramPriorityB = ddrPriority[b.ramDDRType] || 4;

                    if (ramPriorityA !== ramPriorityB) {
                        return ascending ? ramPriorityA - ramPriorityB : ramPriorityB - ramPriorityA;
                    }

                    const ramPriceA = parseFloat(a.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                    const ramPriceB = parseFloat(b.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                    return ramPriceA - ramPriceB;
                case 'Storage':
                    if (a.totalStorageGB !== b.totalStorageGB) {
                        return ascending ? a.totalStorageGB - b.totalStorageGB : b.totalStorageGB - a.totalStorageGB;
                    }

                    const storagePriority = { 'HDD': 1, 'SSD': 2, 'NVME': 3, 'NVME PCIE 4': 4, 'UNKNOWN': 0 };
                    const storagePriorityA = storagePriority[a.storageType] || 0;
                    const storagePriorityB = storagePriority[b.storageType] || 0;

                    if (storagePriorityA !== storagePriorityB) {
                        return ascending ? storagePriorityA - storagePriorityB : storagePriorityB - storagePriorityA;
                    }

                    const storagePriceA = parseFloat(a.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                    const storagePriceB = parseFloat(b.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                    return storagePriceA - storagePriceB;
                case 'Extra':
                    valueA = a.extra;
                    valueB = b.extra;
                    break;
                case 'Preis pro Monat':
                    valueA = parseFloat(a.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                    valueB = parseFloat(b.price.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
                    break;
                default:
                    return 0;
            }

            if (typeof valueA === 'string' && typeof valueB === 'string') {
                return ascending ? valueA.localeCompare(valueB) : valueB.localeCompare(valueA);
            }

            if (ascending) {
                return valueA - valueB;
            } else {
                return valueB - valueA;
            }
        });

        const containerDiv = document.querySelector('#SPArea main section div');
        if (containerDiv) {
            allServers.forEach(server => {
                containerDiv.removeChild(server.element);
            });

            allServers.forEach(server => {
                containerDiv.appendChild(server.element);
            });
        }
    }


    // Extracts server data from DOM elements
    function getAllServers(){
        let allChildDivs = [];
        const spArea = document.getElementById('SPArea');
        if (spArea) {
            const main = spArea.querySelector('main');
            if (main) {
                const section = main.querySelector('section');
                if (section) {
                    const containerDiv = section.querySelector('div');
                    if (containerDiv) {
                        allChildDivs = containerDiv.querySelectorAll(':scope > div');
                        allChildDivs = Array.from(allChildDivs);
                        allChildDivs = allChildDivs.slice(2);
                    }
                }
            }
        }

        const servers = allChildDivs.map(serverDiv => {
            const desktopView = serverDiv.querySelector('.d-none.d-lg-block .row.card-color');
            if (!desktopView) return null;

            const columns = desktopView.querySelectorAll('.col');

            const ramColumn = columns[1];
            let totalRamGB = 0;
            let ramText = '';
            let ramDDRType = '';

            if (ramColumn) {
                ramText = ramColumn.innerHTML;

                const ramMatch = ramText.match(/(\d+(?:[.,]\d+)?)\s*GB/i);
                if (ramMatch) {
                    totalRamGB = parseFloat(ramMatch[1].replace(',', '.'));
                }
                if (ramText.includes('DDR5')) {
                    ramDDRType = 'DDR5';
                } else if (ramText.includes('DDR4')) {
                    ramDDRType = 'DDR4';
                } else if (ramText.includes('DDR3 ECC')) {
                    ramDDRType = 'DDR3 ECC';
                } else if (ramText.includes('DDR3')) {
                    ramDDRType = 'DDR3';
                } else {
                    ramDDRType = 'DDR4';
                }
            }

            const storageColumn = columns[2];
            let totalStorageGB = 0;
            let storageText = '';
            let storageType = '';
            let storageDevices = [];

            if (storageColumn) {
                storageText = storageColumn.innerHTML;
                if (storageText.includes('<br>')) {
                    storageDevices = storageText.split('<br>').map(device => device.trim()).filter(device => device);
                } else {
                    storageDevices = storageText.split(/,\s*/).map(device => device.trim()).filter(device => device);
                }

                let highestTypePriority = 0;

                totalStorageGB = storageDevices.reduce((total, device) => {
                    const multiplierMatch = device.match(/^(\d+)x\s*/i);
                    const multiplier = multiplierMatch ? parseInt(multiplierMatch[1]) : 1;

                    const match = device.match(/(\d+(?:[.,]\d+)?)\s*(GB|TB)\s*(.*)/i);
                    if (match) {
                        const value = parseFloat(match[1].replace(',', '.')) * multiplier;
                        const unit = match[2].toUpperCase();
                        const type = match[3].trim().toUpperCase();

                        let typePriority = 0;
                        if (type.includes('NVME PCIE 4') || type.includes('NVME PCI-E 4')) {
                            typePriority = 4;
                        } else if (type.includes('NVME')) {
                            typePriority = 3;
                        } else if (type.includes('SSD')) {
                            typePriority = 2;
                        } else if (type.includes('HDD')) {
                            typePriority = 1;
                        }

                        if (typePriority > highestTypePriority) {
                            highestTypePriority = typePriority;
                        }

                        let gbValue = 0;
                        switch(unit) {
                            case 'GB': gbValue = value; break;
                            case 'TB': gbValue = value * 1000; break;
                        }

                        return total + gbValue;
                    }
                    return total;
                }, 0);

                switch(highestTypePriority) {
                    case 4: storageType = 'NVME PCIE 4'; break;
                    case 3: storageType = 'NVME'; break;
                    case 2: storageType = 'SSD'; break;
                    case 1: storageType = 'HDD'; break;
                    default: storageType = 'UNKNOWN';
                }
            }
            const cpuText = columns[0]?.textContent.trim() || '';
            let cpuVendor = '';
            let cpuModel = cpuText;

            if (cpuText.includes('Intel') || cpuText.includes('Xeon')) {
                cpuVendor = 'Intel';
            } else if (cpuText.includes('AMD') || cpuText.includes('Ryzen') || cpuText.includes('EPYC') || cpuText.includes('Threadripper')) {
                cpuVendor = 'AMD';
            }

            const allStorageTypes = [];
            if (storageDevices && storageDevices.length > 0) {
                storageDevices.forEach(device => {
                    const multiplierMatch = device.match(/^(\d+)x\s*/i);
                    const multiplier = multiplierMatch ? parseInt(multiplierMatch[1]) : 1;
                    const match = device.match(/(\d+(?:[.,]\d+)?)\s*(GB|TB)\s*(.*)/i);
                    if (match) {
                        const type = match[3].trim().toUpperCase();
                        let typePriority = 0;
                        if (type.includes('NVME PCIE 4') || type.includes('NVME PCI-E 4')) {
                            typePriority = 4;
                        } else if (type.includes('NVME')) {
                            typePriority = 3;
                        } else if (type.includes('SSD')) {
                            typePriority = 2;
                        } else if (type.includes('HDD')) {
                            typePriority = 1;
                        }

                        let storageTypeName = '';
                        switch(typePriority) {
                            case 4: storageTypeName = 'NVME PCIE 4'; break;
                            case 3: storageTypeName = 'NVME'; break;
                            case 2: storageTypeName = 'SSD'; break;
                            case 1: storageTypeName = 'HDD'; break;
                        }

                        if (storageTypeName && !allStorageTypes.includes(storageTypeName)) {
                            allStorageTypes.push(storageTypeName);
                        }
                    }
                });
            }

            const hasExtra = columns[3]?.textContent.trim() !== '';
            const priceNumeric = parseFloat(columns[4]?.textContent.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;

            return {
                element: serverDiv,
                title: columns[0]?.textContent.trim() || '',
                cpu: columns[0]?.textContent.trim() || '',
                cpuVendor: cpuVendor,
                cpuModel: cpuModel,
                ram: columns[1]?.textContent.trim() || '',
                ramText: ramText,
                totalRamGB: totalRamGB,
                ramDDRType: ramDDRType,
                storage: columns[2]?.textContent.trim() || '',
                storageText: storageText,
                totalStorageGB: totalStorageGB,
                storageType: storageType,
                storageTypes: allStorageTypes,
                extra: columns[3]?.textContent.trim() || '',
                hasExtra: hasExtra,
                price: columns[4]?.textContent.trim() || '',
                priceNumeric: priceNumeric,
                orderButton: columns[5]?.innerHTML || ''
            };
        }).filter(server => server !== null);

        return servers;
    }




    // Makes column headers clickable for sorting
    function makeColumnsClickable() {
        let categoriesDiv = null;
        let card = document.querySelectorAll(`.${targetClass}`)[0];
        if (card) {
            categoriesDiv = card.children[0].children[0].children[0].children[0];
        }


        if (!categoriesDiv) {
            return;
        }

        const allChildDivs = Array.from(categoriesDiv.children);
        const categoryDivs = allChildDivs.filter(div => div.textContent.trim());
        const categoryNames = categoryDivs.map(div => div.textContent.trim());
        categoryDivs.forEach((categoryDiv, index) => {
            const text = categoryDiv.textContent.trim();
            if (!text) {
                return;
            }

            const arrow = document.createElement('span');
            arrow.innerHTML = '▼';
            arrow.style.marginLeft = '5px';
            arrow.style.fontSize = '12px';
            arrow.style.opacity = '0.7';
            arrow.style.transition = 'opacity 0.2s';

            categoryDiv.appendChild(arrow);

            categoryDiv.style.cursor = 'pointer';
            categoryDiv.style.userSelect = 'none';
            categoryDiv.style.display = 'flex';
            categoryDiv.style.alignItems = 'center';
            categoryDiv.style.justifyContent = 'center';
            categoryDiv.title = `Click to sort by ${text}`;

            categoryDiv.addEventListener('mouseenter', () => {
                categoryDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                arrow.style.opacity = '1';
            });

            categoryDiv.addEventListener('mouseleave', () => {
                categoryDiv.style.backgroundColor = '';
                arrow.style.opacity = '0.7';
            });

            categoryDiv.addEventListener('click', () => {
                let ascending;
                if (arrow.innerHTML === '▼') {
                    arrow.innerHTML = '▲';
                    ascending = true;
                } else if (arrow.innerHTML === '▲') {
                    arrow.innerHTML = '▼';
                    ascending = false;
                }

                categoryDivs.forEach((otherCategoryDiv, otherIndex) => {
                    if (otherIndex !== index) {
                        const otherArrow = otherCategoryDiv.querySelector('span');
                        if (otherArrow) {
                            otherArrow.innerHTML = '▼';
            }
        }
    });

                sortBy(text, ascending);
            });
        });

        return { categoryNames };
    }

    // Initializes the filtering system
    function initializeFiltering() {
        allServers = getAllServers();

        const filterUI = createFilterUI();
        const containerDiv = document.querySelector('#SPArea main section div');
        if (containerDiv && containerDiv.children.length >= 2) {
            containerDiv.insertBefore(filterUI, containerDiv.children[1]);
        }

        populateFilters(allServers);
    }

    makeColumnsClickable();

    setTimeout(initializeFiltering, 500);


})();
