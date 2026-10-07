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
    res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Get ID from URL
    const id = parseInt(req.query.id);
    
    if (isNaN(id)) {
        res.status(400).json({ error: 'Invalid expense ID' });
        return;
    }

    // Check if Supabase is configured
    if (!supabase) {
        res.status(200).json({ success: true, note: 'No database configured' });
        return;
    }

    try {
        // GET /api/expenses/:id - get single expense
        if (req.method === 'GET') {
            const { data, error } = await supabase
                .from('expenses')
                .select('*')
                .eq('id', id)
                .single();

            if (error) throw error;
            if (!data) {
                res.status(404).json({ error: 'Expense not found' });
                return;
            }

            res.status(200).json({
                id: data.id,
                item: data.item,
                price: data.price,
                buyer: data.buyer,
                sharedWith: data.sharedwith || []
            });
        }
        // PUT /api/expenses/:id - update expense
        else if (req.method === 'PUT') {
            const expense = req.body;

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
                    id: data.id,
                    item: data.item,
                    price: data.price,
                    buyer: data.buyer,
                    sharedWith: data.sharedwith || []
                }
            });
        }
        // DELETE /api/expenses/:id - delete expense
        else if (req.method === 'DELETE') {
            console.log(`Attempting to delete expense with id: ${id}`);
            
            const { data, error } = await supabase
                .from('expenses')
                .delete()
                .eq('id', id)
                .select();

            if (error) {
                console.error('Delete error:', error);
                res.status(500).json({ error: error.message });
                return;
            }

            console.log(`Delete result:`, data);
            res.status(200).json({ success: true, deleted: data });
        }
        else {
            res.status(405).json({ error: 'Method not allowed' });
        }
    } catch (error) {
        console.error('API Error:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
};