import { Router } from 'express';
import { saveSellerRedis } from '../controller/seller/seller.js';

const seller = Router();

seller.post('/', async (req, res) => {
    const data = req.body;
    try {
        const save = await saveSellerRedis(data.seller, data);
        return res.status(200).json({
            estado: true,
            message: save
        });
    } catch (error) {
        return res.status(500).json({
            estado: false,
            error: -1,
            message: error.message || error
        });
    }
});

export default seller;
