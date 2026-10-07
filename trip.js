let expenses = [];
let accumulatedRemainder = 0; // Track accumulated remainder from previous calculations
const ALL_NAMES = ["San Lin Htun","Nandar Moe Thae", "Ko Pyae Sone", "Htet Htet Aung", "Aung Myo Thet", "Shinn Bhone Myat", "Aye Pyae Pyae Phyoe", "Aung Thila", "Hnin Aye Wai", "Ko Chan Nyein Tun", "Ma Phue", "Nandar Lay", "Kyaw Gyi"];

// Load expenses from server
async function loadExpenses() {
    try {
        let res = await fetch('/api/expenses');
        if (res.ok) {
            let data = await res.json();
            if (Array.isArray(data)) {
                expenses = data;
            } else {
                expenses = data.expenses || [];
            }
        }
    } catch (e) {
        console.error('Failed to load from server, fallback to localStorage');
        expenses = JSON.parse(localStorage.getItem('tripBudget')) || [];
    }
    updateTable();
}

// Save expenses to server silently (no popup)
async function saveExpenses() {
    try {
        await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(expenses)
        });
    } catch (e) {
        console.error('Server save failed, fallback to localStorage');
        localStorage.setItem('tripBudget', JSON.stringify(expenses));
    }
}

// Save single expense to server (insert or update)
async function saveExpense(expense, index) {
    try {
        if (expense.id) {
            // Update existing expense
            await fetch(`/api/expenses/${expense.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expense)
            });
        } else {
            // Insert new expense
            let res = await fetch('/api/expenses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(expense)
            });
            if (res.ok) {
                let data = await res.json();
                if (data.expense) {
                    expenses[index] = data.expense;
                }
            }
        }
    } catch (e) {
        console.error('Server save failed, fallback to localStorage');
        localStorage.setItem('tripBudget', JSON.stringify(expenses));
    }
}

// Delete expense from server
async function deleteExpenseFromServer(index) {
    try {
        let expense = expenses[index];
        console.log('Delete expense from server:', expense);
        
        if (!expense) {
            console.error('No expense at index:', index);
            return;
        }
        
        if (!expense.id) {
            console.error('Expense has no id:', expense);
            alert('Cannot delete: Expense ID not found. Please refresh the page.');
            return;
        }
        
        console.log('Deleting expense with id:', expense.id);
        let response = await fetch(`/api/expenses/${expense.id}`, {
            method: 'DELETE'
        });
        
        console.log('Delete response status:', response.status);
        console.log('Delete response headers:', response.headers.get('content-type'));
        
        // Check if response is JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Delete returned non-JSON response:', text);
            throw new Error('Server returned invalid response. Check Vercel logs.');
        }
        
        if (!response.ok) {
            let errorData = await response.json();
            console.error('Delete failed:', errorData);
            throw new Error(errorData.error || 'Delete failed');
        }
        
        let result = await response.json();
        console.log('Delete successful:', result);
    } catch (e) {
        console.error('Server delete failed:', e);
        throw e;
    }
}

function formatPrice(price) {
    return Number(price).toLocaleString();
}

function updateTable() {
    let table = document.getElementById("budgetTable");
    let total = 0;
    table.innerHTML = "<tr><th>Item</th><th>Price</th><th>By</th><th></th></tr>";

    expenses.forEach((ex, index) => {
        let priceNum = parseInt(ex.price);
        total += priceNum;
        let sharedWithText = ex.sharedWith && ex.sharedWith.length > 0 
            ? `Shared with: ${ex.sharedWith.length} people` 
            : '';
        table.innerHTML += `<tr>
            <td class="editable" data-index="${index}" data-field="item" onclick="editCell(this)">${escapeHtml(ex.item)}</td>
            <td class="price-col editable" data-index="${index}" data-field="price" onclick="editCell(this)">¥${formatPrice(priceNum)}</td>
            <td class="editable" data-index="${index}" data-field="buyer" onclick="editCell(this)">${escapeHtml(ex.buyer)}</td>
        <td><small>${sharedWithText}</small><br><button class="btn-delete" onclick="deleteItem(${index})" title="Delete this item">✕</button></td>
        </tr>`;
    });

    document.getElementById("total").innerText = formatPrice(total);
    updatePerPerson();
    updateSettlementTable();
}

function editCell(cell) {
    // Don't start editing if already editing
    if (cell.querySelector('input') || cell.querySelector('select')) return;

    let index = parseInt(cell.dataset.index);
    let field = cell.dataset.field;
    let currentValue = expenses[index][field];

    if (field === 'buyer') {
        // Show dropdown for buyer
        let names = ["Yan Naung", "Theint", "Arkar", "Yamin", "Ko San", "Aung Zaw Lin", "Ko Kaung", "Zayar Phyo", "Thel Thel Nu", "Khaing Su Mon", "Khaing Su Mon's BF", "Myo Pa", "May Zon Thu", "May Zon Thu's BF"];
        let select = document.createElement('select');
        select.className = 'inline-edit';
        select.innerHTML = '<option value="">— Select —</option>';
        names.forEach(name => {
            select.innerHTML += `<option value="${name}"${name === currentValue ? ' selected' : ''}>${name}</option>`;
        });
        cell.textContent = '';
        cell.appendChild(select);
        select.focus();

        select.addEventListener('change', function() {
            let newValue = this.value.trim();
            if (newValue && newValue !== currentValue) {
                expenses[index][field] = newValue;
                saveExpense(expenses[index], index);
                updateTable();
            } else {
                updateTable();
            }
        });
        select.addEventListener('blur', function() {
            updateTable();
        });
    } else {
        // Text input for item and price
        let input = document.createElement('input');
        input.type = field === 'price' ? 'number' : 'text';
        input.className = 'inline-edit';
        input.value = currentValue;
        input.min = field === 'price' ? '0' : '';
        cell.textContent = '';
        cell.appendChild(input);
        input.focus();
        input.select();

        function finishEdit() {
            let newValue = input.value.trim();
            if (field === 'price') {
                newValue = parseInt(newValue);
                if (isNaN(newValue) || newValue <= 0) {
                    updateTable();
                    return;
                }
                newValue = String(newValue);
            }
            if (newValue && newValue !== String(currentValue)) {
                expenses[index][field] = newValue;
                saveExpense(expenses[index], index);
            }
            updateTable();
        }

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                input.blur();
            }
            if (e.key === 'Escape') {
                updateTable();
            }
        });
    }
}

function updatePerPerson() {
    let perPerson = {};
    expenses.forEach(ex => {
        let buyer = ex.buyer.trim();
        if (!buyer) return;
        perPerson[buyer] = (perPerson[buyer] || 0) + parseInt(ex.price);
    });

    let container = document.getElementById("perPerson");
    container.innerHTML = "";
    Object.entries(perPerson).sort().forEach(([name, total]) => {
        let div = document.createElement("div");
        div.className = "person-total";
        div.textContent = `${name}: ¥${formatPrice(total)}`;
        container.appendChild(div);
    });
}

function updateSettlementTable() {
    let table = document.getElementById("settlementTable");
    table.innerHTML = "<tr><th>Name</th><th>Share of Expenses</th><th>Spent</th><th style='text-align: right;'>Balance</th><th>Actions</th></tr>";

    let totalSpent = expenses.reduce((sum, ex) => sum + parseInt(ex.price), 0);
    if (totalSpent <= 0) return;

    // Calculate each person's share based on what they're sharing in
    let shareOfExpenses = {};
    let spent = {};
    ALL_NAMES.forEach(name => {
        shareOfExpenses[name] = 0;
        spent[name] = 0;
    });

    // Start with the global accumulated remainder
    let currentRemainder = accumulatedRemainder;
    
    expenses.forEach(ex => {
        let buyer = ex.buyer.trim();
        if (spent.hasOwnProperty(buyer)) {
            spent[buyer] += parseInt(ex.price);
        }
        
        // Add to share if this person is in the sharedWith list
        if (ex.sharedWith && ex.sharedWith.length > 0) {
            // Calculate price with accumulated remainder
            let totalToDivide = parseInt(ex.price) + currentRemainder;
            let pricePerPerson = Math.floor(totalToDivide / ex.sharedWith.length);
            let newRemainder = totalToDivide % ex.sharedWith.length;
            
            // Update accumulated remainder for next item
            currentRemainder = newRemainder;
            
            // Distribute the integer part to each person
            ex.sharedWith.forEach(name => {
                if (shareOfExpenses.hasOwnProperty(name)) {
                    shareOfExpenses[name] += pricePerPerson;
                }
            });
        }
    });

    // Update the global accumulated remainder
    accumulatedRemainder = currentRemainder;

    // Build table rows
    ALL_NAMES.forEach(name => {
        let personShare = shareOfExpenses[name];
        let personSpent = spent[name];
        let balance = personSpent - personShare;
        let rowClass = balance > 0 ? 'positive' : 'negative';
        let label = balance > 0 ? `gets ¥${formatPrice(balance)}` : `pays ¥${formatPrice(Math.abs(balance))}`;
        table.innerHTML += `<tr class="${rowClass}">
            <td>${escapeHtml(name)}</td>
            <td class="price-col">¥${formatPrice(personShare)}</td>
            <td class="price-col">¥${formatPrice(personSpent)}</td>
            <td class="price-col">${label}</td>
            <td><button class="btn-pdf" onclick="downloadIndividualPaySlip('${name}')">📄 PDF</button></td>
        </tr>`;
    });

    // Add total row
    let totalShare = Object.values(shareOfExpenses).reduce((a, b) => a + b, 0);
    let diff = totalSpent - totalShare;
    table.innerHTML += `<tr class="total-row">
        <td><strong>Total</strong></td>
        <td class="price-col"><strong>¥${formatPrice(totalShare)}</strong></td>
        <td class="price-col"><strong>¥${formatPrice(totalSpent)}</strong></td>
            <td class="price-col"><strong>Remainder: ¥${formatPrice(diff)}</strong></td>
        <td></td>
    </tr>`;
}

function escapeHtml(str) {
    let div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

async function addItem() {
    let item = document.getElementById("item").value.trim();
    let price = document.getElementById("price").value;
    let buyer = document.getElementById("buyer").value.trim();

    if (!item) {
        alert("Please enter an item name.");
        document.getElementById("item").focus();
        return;
    }
    if (!price || parseInt(price) <= 0) {
        alert("Please enter a valid price (greater than 0).");
        document.getElementById("price").focus();
        return;
    }
    if (!buyer) {
        alert("Please enter who purchased the item.");
        document.getElementById("buyer").focus();
        return;
    }

    // Get selected members to share with
    let sharedWith = [];
    document.querySelectorAll('.member-check:checked').forEach(cb => {
        sharedWith.push(cb.value);
    });

    if (sharedWith.length === 0) {
        alert("Please select at least one person to share with.");
        return;
    }

    let newExpense = { item, price, buyer, sharedWith };
    expenses.push(newExpense);
    await saveExpense(newExpense, expenses.length - 1);
    updateTable();

    // Clear inputs
    document.getElementById("item").value = "";
    document.getElementById("price").value = "";
    document.getElementById("buyer").value = "";
    document.querySelectorAll('.member-check').forEach(cb => cb.checked = false);
    document.querySelectorAll('.group-check').forEach(cb => cb.checked = false);
    document.getElementById("item").focus();
}

async function deleteItem(index) {
    console.log('Delete clicked, index:', index);
    if (!confirm("Are you sure you want to delete this item?")) return;
    
    console.log('Confirmed, deleting...');
    try {
        console.log('Calling deleteExpenseFromServer...');
        await deleteExpenseFromServer(index);
        console.log('Server delete complete');
        expenses.splice(index, 1);
        updateTable();
    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete item. Please try again.');
    }
}

function downloadPDF() {
    // Calculate settlement data
    let totalSpent = expenses.reduce((sum, ex) => sum + parseInt(ex.price), 0);
    if (totalSpent <= 0) {
        alert("No expenses to export.");
        return;
    }

    let shareOfExpenses = {};
    let spent = {};
    ALL_NAMES.forEach(name => {
        shareOfExpenses[name] = 0;
        spent[name] = 0;
    });

    // Calculate with accumulated remainder
    let currentRemainder = accumulatedRemainder;
    
    expenses.forEach(ex => {
        let buyer = ex.buyer.trim();
        if (spent.hasOwnProperty(buyer)) {
            spent[buyer] += parseInt(ex.price);
        }
        
        if (ex.sharedWith && ex.sharedWith.length > 0) {
            // Calculate price with accumulated remainder
            let totalToDivide = parseInt(ex.price) + currentRemainder;
            let pricePerPerson = Math.floor(totalToDivide / ex.sharedWith.length);
            let newRemainder = totalToDivide % ex.sharedWith.length;
            
            // Update accumulated remainder for next item
            currentRemainder = newRemainder;
            
            ex.sharedWith.forEach(name => {
                if (shareOfExpenses.hasOwnProperty(name)) {
                    shareOfExpenses[name] += pricePerPerson;
                }
            });
        }
    });

    // Create printable HTML for all members
    let printWindow = window.open('', '_blank', 'width=800,height=600');
    let date = new Date().toLocaleDateString('ja-JP');
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Trip Budget Pay Slip - ${date}</title>
            <style>
                body {
                    font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    text-align: center;
                    color: #333;
                    border-bottom: 3px solid #4CAF50;
                    padding-bottom: 10px;
                }
                .date {
                    text-align: right;
                    color: #666;
                    margin-bottom: 20px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th {
                    background: #4CAF50;
                    color: white;
                    padding: 10px;
                    text-align: left;
                }
                td {
                    padding: 8px 10px;
                    border-bottom: 1px solid #ddd;
                }
                .total-row {
                    background: #f5f5f5;
                    font-weight: bold;
                }
                .positive {
                    color: #2e7d32;
                }
                .negative {
                    color: #c62828;
                }
                .summary {
                    margin-top: 30px;
                    padding: 15px;
                    background: #f9f9f9;
                    border-radius: 5px;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #999;
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>Trip Budget Pay Slip</h1>
            <div class="date">${date}</div>
            
            <h2>Expense Details</h2>
            <table>
                <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Price (¥)</th>
                    <th>Purchased By</th>
                    <th>Shared With</th>
                </tr>
    `;

    expenses.forEach((ex, index) => {
        let sharedWithText = ex.sharedWith && ex.sharedWith.length > 0 
            ? ex.sharedWith.join(', ') 
            : 'N/A';
        html += `
            <tr>
                <td>${index + 1}</td>
                <td>${escapeHtml(ex.item)}</td>
                <td>¥${formatPrice(parseInt(ex.price))}</td>
                <td>${escapeHtml(ex.buyer)}</td>
                <td>${sharedWithText}</td>
            </tr>
        `;
    });

    let totalShare = Object.values(shareOfExpenses).reduce((a, b) => a + b, 0);
    let diff = totalSpent - totalShare;

    html += `
                <tr class="total-row">
                    <td colspan="2"><strong>Total</strong></td>
                    <td><strong>¥${formatPrice(totalSpent)}</strong></td>
                    <td colspan="2"></td>
                </tr>
            </table>

            <h2>Settlement Summary</h2>
            <table>
                <tr>
                    <th>Name</th>
                    <th>Share of Expenses (¥)</th>
                    <th>Spent (¥)</th>
                    <th>Balance (¥)</th>
                    <th>Action</th>
                </tr>
        `;

        ALL_NAMES.forEach(name => {
            let personShare = shareOfExpenses[name];
            let personSpent = spent[name];
            let balance = personSpent - personShare;
            let rowClass = balance > 0 ? 'positive' : 'negative';
            let label = balance > 0 
                ? `Gets ¥${formatPrice(balance)}` 
                : `Pays ¥${formatPrice(Math.abs(balance))}`;
            
            html += `
                <tr class="${rowClass}">
                    <td>${escapeHtml(name)}</td>
                    <td>¥${formatPrice(personShare)}</td>
                    <td>¥${formatPrice(personSpent)}</td>
                    <td>${label}</td>
                    <td></td>
                </tr>
            `;
        });

    html += `
                <tr class="total-row">
                    <td><strong>Total</strong></td>
                    <td><strong>¥${formatPrice(totalShare)}</strong></td>
                    <td><strong>¥${formatPrice(totalSpent)}</strong></td>
                            <td><strong>Remainder: ¥${formatPrice(diff)}</strong></td>
                </tr>
            </table>
            <div class="summary">
                <h3>Summary</h3>
                <p><strong>Total Expenses:</strong> ¥${formatPrice(totalSpent)}</p>
                <p><strong>Number of People:</strong> ${ALL_NAMES.length}</p>
                <p><strong>Remainder:</strong> ¥${formatPrice(diff)}</p>
            </div>

            <div class="footer">
                <p>Generated on ${date}</p>
                <p class="no-print">Press Ctrl+P (Cmd+P on Mac) to save as PDF</p>
                <button onclick="window.close()" style="margin-top: 10px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">← Close & Return</button>
            </div>
            
            <script>
                // Use the global createPayPayPayment function from trip.js
                // It will be available when the main page is loaded
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    // Don't auto-trigger print dialog
    // User can manually print or return to main page
}

function downloadIndividualPaySlip(personName) {
    // Calculate settlement data
    let totalSpent = expenses.reduce((sum, ex) => sum + parseInt(ex.price), 0);
    if (totalSpent <= 0) {
        alert("No expenses to export.");
        return;
    }

    let shareOfExpenses = {};
    let spent = {};
    ALL_NAMES.forEach(name => {
        shareOfExpenses[name] = 0;
        spent[name] = 0;
    });

    // Calculate with accumulated remainder
    let currentRemainder = accumulatedRemainder;
    
    expenses.forEach(ex => {
        let buyer = ex.buyer.trim();
        if (spent.hasOwnProperty(buyer)) {
            spent[buyer] += parseInt(ex.price);
        }
        
        if (ex.sharedWith && ex.sharedWith.length > 0) {
            // Calculate price with accumulated remainder
            let totalToDivide = parseInt(ex.price) + currentRemainder;
            let pricePerPerson = Math.floor(totalToDivide / ex.sharedWith.length);
            let newRemainder = totalToDivide % ex.sharedWith.length;
            
            // Update accumulated remainder for next item
            currentRemainder = newRemainder;
            
            ex.sharedWith.forEach(name => {
                if (shareOfExpenses.hasOwnProperty(name)) {
                    shareOfExpenses[name] += pricePerPerson;
                }
            });
        }
    });

    let personShare = shareOfExpenses[personName] || 0;
    let personSpent = spent[personName] || 0;
    let balance = personSpent - personShare;

    // Create printable HTML for individual
    let printWindow = window.open('', '_blank', 'width=800,height=600');
    let date = new Date().toLocaleDateString('ja-JP');
    
    let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Pay Slip - ${personName} - ${date}</title>
            <style>
                body {
                    font-family: "Hiragino Sans", "Yu Gothic", sans-serif;
                    padding: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                h1 {
                    text-align: center;
                    color: #333;
                    border-bottom: 3px solid #4CAF50;
                    padding-bottom: 10px;
                }
                h2 {
                    color: #333;
                    margin-top: 25px;
                    border-bottom: 2px solid #4CAF50;
                    padding-bottom: 5px;
                }
                .date {
                    text-align: right;
                    color: #666;
                    margin-bottom: 20px;
                }
                .person-name {
                    text-align: center;
                    font-size: 24px;
                    font-weight: bold;
                    color: #4CAF50;
                    margin: 15px 0;
                    padding: 10px;
                    background: #f0f8f0;
                    border-radius: 5px;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                }
                th {
                    background: #4CAF50;
                    color: white;
                    padding: 10px;
                    text-align: left;
                }
                td {
                    padding: 8px 10px;
                    border-bottom: 1px solid #ddd;
                }
                .price-col {
                    text-align: right;
                }
                .total-row {
                    background: #f5f5f5;
                    font-weight: bold;
                }
                .positive {
                    color: #2e7d32;
                }
                .negative {
                    color: #c62828;
                }
                .balance-section {
                    margin-top: 30px;
                    padding: 20px;
                    background: #f9f9f9;
                    border-radius: 5px;
                    border: 1px solid #e0e0e0;
                }
                .balance-item {
                    display: flex;
                    justify-content: space-between;
                    padding: 10px 0;
                    border-bottom: 1px solid #e0e0e0;
                    font-size: 16px;
                }
                .balance-item:last-child {
                    border-bottom: none;
                }
                .footer {
                    margin-top: 30px;
                    text-align: center;
                    font-size: 12px;
                    color: #999;
                }
                @media print {
                    body { padding: 0; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <h1>Trip Budget Pay Slip</h1>
            <div class="date">${date}</div>
            <div class="person-name">${personName}</div>
            
            <h2>Your Expenses</h2>
            <table>
                <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th class="price-col">Price (¥)</th>
                    <th>Shared Among</th>
                    <th class="price-col">Your Share (¥)</th>
                </tr>
    `;

    // Calculate individual shares with accumulated remainder
    let itemIndex = 1;
    let individualCurrentRemainder = 0;
    
    expenses.forEach(ex => {
        if (ex.sharedWith && ex.sharedWith.includes(personName)) {
            // Calculate price with accumulated remainder
            let totalToDivide = parseInt(ex.price) + individualCurrentRemainder;
            let pricePerPerson = Math.floor(totalToDivide / ex.sharedWith.length);
            let newRemainder = totalToDivide % ex.sharedWith.length;
            
            // Update accumulated remainder for next item
            individualCurrentRemainder = newRemainder;
            
            let sharedCount = ex.sharedWith.length;
            html += `
                <tr>
                    <td>${itemIndex}</td>
                    <td>${escapeHtml(ex.item)}</td>
                    <td class="price-col">¥${formatPrice(parseInt(ex.price))}</td>
                    <td>${sharedCount} people</td>
                    <td class="price-col">¥${formatPrice(pricePerPerson)}</td>
                </tr>
            `;
            itemIndex++;
        }
    });

    html += `
                <tr class="total-row">
                    <td colspan="4"><strong>Your Total Share</strong></td>
                    <td style="text-align: right;"><strong>¥${formatPrice(personShare)}</strong></td>
                </tr>
            </table>

            <div class="balance-section">
                <h2>Balance Summary</h2>
                <div class="balance-item">
                    <span>Total Spent (purchases you made):</span>
                    <span>¥${formatPrice(personSpent)}</span>
                </div>
                <div class="balance-item">
                    <span>Your Share of Expenses:</span>
                    <span>¥${formatPrice(personShare)}</span>
                </div>
                <div class="balance-item ${balance >= 0 ? 'positive' : 'negative'}">
                    <span>${balance >= 0 ? 'You Get' : 'You Pay'}:</span>
                    <span>¥${formatPrice(Math.abs(balance))}</span>
                </div>
            </div>

            <div class="footer">
                <p>Generated on ${date}</p>
                <p class="no-print">Press Ctrl+P (Cmd+P on Mac) to save as PDF</p>
                <button onclick="window.location.href = '/'" style="margin-top: 10px; padding: 8px 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer;">← Back to Main Page</button>
            </div>

            <script>
                // Use the global createPayPayPayment function from trip.js
                // It will be available when the main page is loaded
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    
    // Don't auto-trigger print dialog
    // User can manually print or close window
}

function clearInputs() {
    document.getElementById("item").value = "";
    document.getElementById("price").value = "";
    document.getElementById("buyer").value = "";
    document.querySelectorAll('.member-check').forEach(cb => cb.checked = false);
    document.querySelectorAll('.group-check').forEach(cb => cb.checked = false);
    document.getElementById("item").focus();
}

// Allow Enter key to add item
document.addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
        let active = document.activeElement;
        if (active && (active.tagName === "INPUT" || active.tagName === "SELECT")) {
            addItem();
        }
    }
});

// Group selection functions
function toggleGroup(groupName) {
    let group = GROUPS[groupName];
    if (!group) return;
    
    let groupCheckbox = document.querySelector(`.group-check[data-group="${groupName}"]`);
    if (!groupCheckbox) return;
    
    // If group checkbox is checked, select all members in the group
    if (groupCheckbox.checked) {
        group.forEach(name => {
            let checkbox = document.querySelector(`.member-check[value="${name}"]`);
            if (checkbox) checkbox.checked = true;
        });
    } else {
        // If group checkbox is unchecked, deselect all members in the group
        group.forEach(name => {
            let checkbox = document.querySelector(`.member-check[value="${name}"]`);
            if (checkbox) checkbox.checked = false;
        });
    }
    
    // Update group checkboxes based on member selections
    updateGroupCheckboxes();
}

function updateGroupCheckboxes() {
    Object.entries(GROUPS).forEach(([groupName, group]) => {
        let groupCheckbox = document.querySelector(`.group-check[data-group="${groupName}"]`);
        if (!groupCheckbox) return;
        
        let allChecked = group.every(name => {
            let checkbox = document.querySelector(`.member-check[value="${name}"]`);
            return checkbox && checkbox.checked;
        });
        
        // Update group checkbox state
        groupCheckbox.checked = allChecked;
    });
}

// Select group function for group buttons
function selectGroup(groupName) {
    let checkbox = document.querySelector(`.group-check[data-group="${groupName}"]`);
    if (checkbox) {
        checkbox.checked = !checkbox.checked;
        toggleGroup(groupName);
    }
}

// Toggle member checkboxes visibility
function toggleMembers() {
    let container = document.getElementById('memberCheckboxes');
    let btn = document.getElementById('toggleMembersBtn');
    container.classList.toggle('collapsed');
    btn.textContent = container.classList.contains('collapsed') ? '▶' : '▼';
}

// Update group checkboxes when member checkboxes change
document.addEventListener('change', function(e) {
    if (e.target.classList.contains('member-check')) {
        updateGroupCheckboxes();
    }
});

// Load data on startup
console.log('Trip Budget app starting...');
loadExpenses();
console.log('Trip Budget app loaded');

// Start with member checkboxes collapsed by default
window.addEventListener('DOMContentLoaded', function() {
    let container = document.getElementById('memberCheckboxes');
    let btn = document.getElementById('toggleMembersBtn');
    if (container) container.classList.add('collapsed');
    if (btn) btn.textContent = '▶';
});

