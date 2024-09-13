const express = require('express');
const router = express.Router();
const app= express();
const bcryptjs = require('bcryptjs');
const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const pino = require('pino');
const logger = pino();
const connectToDatabase = require('../models/db');
const {body,validationResult} = require('express-validator');
const { ReturnDocument } = require('mongodb');


dotenv.config();     
const JWT_SECRET = 'default_secret_key';
router.post('/register',async (req, res) => {
    try {
        const db=await connectToDatabase();
        const collection=db.collection('users');
        const existingEmail = await collection.findOne({ email: req.body.email });
        const salt=await bcryptjs.genSalt(10);
        const hash=await bcryptjs.hash(req.body.password,salt);
        const email=req.body.email;
        const newUser=await collection.insertOne({ 
            email: req.body.email, 
            firstName: req.body.firstName,
            lastName: req.body.lastName,
            password: hash,
            createdAt: new Date(),
      });

      const payload = { 
        user: {
            id: newUser.insertedId,
        },
      };

      const authtoken = jwt.sign(payload, JWT_SECRET);
      logger.info('User registered successfully');
      res.json({authtoken,email});
    } catch (error) {
        res.status(500).send('Internal Server Error');
    }
});

router.post('/login',async (req, res) => {
    try {
        const db=await connectToDatabase();
        const collection=db.collection('users');
        const theUser = await collection.findOne({ email: req.body.email });
        if (theUser) {
            let result=await bcryptjs.compare(req.body.password,theUser.password);
            if(!result){
                logger.info('Passwords do not match');
                return res.status(400).json({ error: 'Wrong password' });
            }
            const userName=theUser.firstName;
            const userEmail=theUser.email;
            let payload = {
                user: {
                    id: theUser._id.toString(),
                },
            };
            const authtoken=jwt.sign(payload,JWT_SECRET);
            logger.info('User logged in successfully');
            return res.status(200).json({ authtoken, userName, userEmail });
        }else{
            logger.info('User not found');
            return res.status(400).json({ error: 'User not found' });
        }
    }catch (e) {
        logger.error(e);
        return res.status(500).json({error:'Internal Server Error',details: e.message});
    }
});

router.post('/update', async(req, res) => {
    const errors= validationResult(req);    
    if(!errors.isEmpty()){
        logger.error('Validation errors in update request', errors.array());
        return res.status(400).json({ errors: errors.array() });
    }



    try{
        const email=req.headers.email;
        if(!email){
            logger.error('Email not found in the request headers');
            return res.status(400).json({ error: 'Email not found in the request headers' });
        }
        const db=await connectToDatabase();
        const collection=db.collection('users');
        const existingUser = await collection.findOne({ email: email });
        if (!existingUser) {
            logger.error('User not found');
            return res.status(404).json({ error: "User not found" });
        }

        existingUser.firstName = req.body.name;
        existingUser.updatedAt = new Date();
        const updatedUser = await collection.findOneAndUpdate({ email }, { $set: existingUser },{ ReturnDocument: 'after'});

        const payload={
            user:{
                id:updatedUser._id.toString(),
            },
        };
        const authtoken=jwt.sign(payload,JWT_SECRET);
        logger.info('User updated successfully');
        res.json({authtoken});
    }catch (e) {
        logger.error(e);
        return res.status(500).json('Internal Server Error');
    }
    
})

module.exports = router;
