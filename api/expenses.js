// Vercel serverless function for Trip Budget
// Uses Supabase (free PostgreSQL) for persistent storage

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

let supabase = null;
if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
}

module.exports = async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Check if Supabase is configured
    if (!supabase) {
        if (req.method === 'GET') {
            // Return empty array if no DB configured
            res.status(200).json([]);
            return;
        }
        if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
            // Accept data but don't persist (will use localStorage fallback)
            res.status(200).json({ success: true, note: 'No database configured. Data not persisted.' });
            return;
        }
    }

    try {
        // GET /api/expenses - load all expenses
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;

            // Map to match frontend format (keep supabase id for updates/deletes)
            const expenses = (data || []).map(row => ({
                id: row.id,
                item: row.item,
                price: row.price,
                buyer: row.buyer,
                sharedWith: row.sharedwith || []
            }));

            res.status(200).json(expenses);
        } 
        // POST /api/expenses - insert new expense
        else if (req.method === 'POST') {
            const expense = req.body;

            // Validate
            if (!expense || !expense.item || !expense.price || !expense.buyer) {
                res.status(400).json({ error: 'Missing required fields: item, price, buyer' });
                return;
            }

            const { data, error } = await supabase
                .from('expenses')
                .insert([{
                    item: expense.item,
                    price: String(expense.price),
                    buyer: expense.buyer,
                    sharedwith: expense.sharedWith || []
                }])
                .select()
                .single();

            if (error) throw error;

            res.status(201).json({ 
                success: true, 
                id: data.id,
                expense: {
                    item: data.item,
                    price: data.price,
                    buyer: data.buyer,
                    sharedWith: data.sharedwith || []
                }
            });
        }
        // PUT /api/expenses/:id - update existing expense
        else if (req.method === 'PUT') {
            const urlParts = req.url.split('/');
            const id = parseInt(urlParts[urlParts.length - 1]);
            
            if (isNaN(id)) {
                res.status(400).json({ error: 'Invalid expense ID' });
                return;
            }

            const expense = req.body;

            // Validate
            if (!expense || !expense.item || !expense.price || !expense.buyer) {
                res.status(400).json({ error: 'Missing required fields: item, price, buyer' });
                return;
            }

            const { data, error } = await supabase
                .from('expenses')
                .update({
                    item: expense.item,
                    price: String(expense.price),
                    buyer: expense.buyer,
                    sharedwith: expense.sharedWith || []
                })
                .eq('id', id)
                .select()
                .single();

            if (error) throw error;

            if (!data) {
                res.status(404).json({ error: 'Expense not found' });
                return;
            }

            res.status(200).json({ 
                success: true,
                expense: {
                    item: data.item,
                    price: data.price,
                    buyer: data.buyer,
                    sharedWith: data.sharedwith || []
                }
            });
        }
        // DELETE /api/expenses/:id - delete expense
        else if (req.method === 'DELETE') {
            const urlParts = req.url.split('/');
            const id = parseInt(urlParts[urlParts.length - 1]);
            
            if (isNaN(id)) {
                return res.status(400).json({ error: 'Invalid expense ID' });
            }

            console.log(`Attempting to delete expense with id: ${id}`);
            
            try {
                const { data, error } = await supabase
                    .from('expenses')
                    .delete()
                    .eq('id', id)
                    .select();

                if (error) {
                    console.error('Delete error:', error);
                    return res.status(500).json({ error: error.message });
                }

                console.log(`Delete result:`, data);
                return res.status(200).json({ success: true, deleted: data });
            } catch (err) {
                console.error('Delete exception:', err);
                return res.status(500).json({ error: err.message });
            }
        }
        else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};