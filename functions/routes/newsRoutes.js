console.log('NR');
const express = require('express');
const router = express.Router();
const path = require('path');
//const multer = require('multer');
const { createNewsArticle, acceptForm, getNewsArticles, deleteNewsArticle, getNewsArticle, modifyNewsArticle, getPopularNews, getTrendingNewsArticles } = require('../controller/newsController');

// const upload = multer({
//     storage: multer.memoryStorage(),
// })

router.get("/" ,(req,res)=>{
    res.send("Hello World");
});

router.post('/create-news',createNewsArticle);
console.log('NR-2');
router.get('/get-news', getNewsArticles);
router.get('/get-news-article/:slug',getNewsArticle);
router.post('/acceptForm', acceptForm);
router.delete('/delete/:slug',deleteNewsArticle);
router.post('/modify-news-article/:slug', modifyNewsArticle);
router.get('/pupular-news',getPopularNews);
router.get('/trending-news',getTrendingNewsArticles);

module.exports=router;