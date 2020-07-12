const express = require('express');
const router = express.Router();
const { User } = require('../models/User');
const { Product } = require('../models/Product');
const { Payment } = require('../models/Payment');

const { auth } = require('../middleware/auth');
const async = require('async');

//=================================
//             User
//=================================

router.get('/auth', auth, (req, res) => {
    res.status(200).json({
        _id: req.user._id,
        isAdmin: req.user.role === 0 ? false : true,
        isAuth: true,
        email: req.user.email,
        name: req.user.name,
        lastname: req.user.lastname,
        role: req.user.role,
        image: req.user.image,
        cart: req.user.cart,
        history: req.user.history,
    });
});

router.post('/register', (req, res) => {
    const user = new User(req.body);

    user.save((err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).json({
            success: true,
        });
    });
});

router.post('/login', (req, res) => {
    User.findOne({ email: req.body.email }, (err, user) => {
        if (!user)
            return res.json({
                loginSuccess: false,
                message: 'Auth failed, email not found',
            });

        user.comparePassword(req.body.password, (err, isMatch) => {
            if (!isMatch) return res.json({ loginSuccess: false, message: 'Wrong password' });

            user.generateToken((err, user) => {
                if (err) return res.status(400).send(err);
                res.cookie('w_authExp', user.tokenExp);
                res.cookie('w_auth', user.token).status(200).json({
                    loginSuccess: true,
                    userId: user._id,
                });
            });
        });
    });
});

router.get('/logout', auth, (req, res) => {
    User.findOneAndUpdate({ _id: req.user._id }, { token: '', tokenExp: '' }, (err, doc) => {
        if (err) return res.json({ success: false, err });
        return res.status(200).send({
            success: true,
        });
    });
});

router.post('/addToCart', auth, (req, res) => {
    //먼저  User Collectionにユーザーの情報を持ってくる
    User.findOne({ _id: req.user._id }, (err, userInfo) => {
        // 引き出した情報からカートに入れようとする商品がもう入っているか確認

        let duplicate = false;
        userInfo.cart.forEach((item) => {
            if (item.id === req.body.productId) {
                duplicate = true;
            }
        });

        //商品がある場合
        if (duplicate) {
            User.findOneAndUpdate({ _id: req.user._id, 'cart.id': req.body.productId }, { $inc: { 'cart.$.quantity': 1 } }, { new: true }, (err, userInfo) => {
                if (err) return res.status(200).json({ success: false, err });
                res.status(200).send(userInfo.cart);
            });
        }
        //商品が無い場合
        else {
            User.findOneAndUpdate(
                { _id: req.user._id },
                {
                    $push: {
                        cart: {
                            id: req.body.productId,
                            quantity: 1,
                            date: Date.now(),
                        },
                    },
                },
                { new: true },
                (err, userInfo) => {
                    if (err) return res.status(400).json({ success: false, err });
                    res.status(200).send(userInfo.cart);
                }
            );
        }
    });
});

router.get('/removeFromCart', auth, (req, res) => {
    //cartに消そうとした商品削除
    User.findOneAndUpdate(
        { _id: req.user._id },
        {
            $pull: { cart: { id: req.query.id } },
        },
        { new: true },
        (err, userInfo) => {
            let cart = userInfo.cart;
            let array = cart.map((item) => {
                return item.id;
            });

            //product collectionで現在残っている商品の情報を持ってくる

            //productIds = ['5e8961794be6d81ce2b94752', '5e8960d721e2ca1cb3e30de4'] に変更
            Product.find({ _id: { $in: array } })
                .populate('writer')
                .exec((err, productInfo) => {
                    return res.status(200).json({
                        productInfo,
                        cart,
                    });
                });
        }
    );
});

router.post('/successBuy', auth, (req, res) => {
    //1. User Collection中のHistoryフィルード中に簡単な決済情報を入れる。
    let history = [];
    let transactionData = {};

    req.body.cartDetail.forEach((item) => {
        history.push({
            dateOfPurchase: Date.now(),
            name: item.title,
            id: item._id,
            price: item.price,
            quantity: item.quantity,
            paymentId: req.body.paymentData.paymentID,
        });
    });

    //2. Payment Collection中に詳細決済情報を入れる
    transactionData.user = {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
    };

    transactionData.data = req.body.paymentData;
    transactionData.product = history;

    //history情報保存
    User.findOneAndUpdate({ _id: req.user._id }, { $push: { history: history }, $set: { cart: [] } }, { new: true }, (err, user) => {
        if (err) return res.json({ success: false, err });

        //payment에다가  transactionData情報保存
        const payment = new Payment(transactionData);
        payment.save((err, doc) => {
            if (err) return res.json({ success: false, err });

            //3. Product Collection中にあるsoldフィルード情報を更新

            //商品quantity

            let products = [];
            doc.product.forEach((item) => {
                products.push({ id: item.id, quantity: item.quantity });
            });

            async.eachSeries(
                products,
                (item, callback) => {
                    Product.update(
                        { _id: item.id },
                        {
                            $inc: {
                                sold: item.quantity,
                            },
                        },
                        { new: false },
                        callback
                    );
                },
                (err) => {
                    if (err) return res.status(400).json({ success: false, err });
                    res.status(200).json({
                        success: true,
                        cart: user.cart,
                        cartDetail: [],
                    });
                }
            );
        });
    });
});

module.exports = router;
