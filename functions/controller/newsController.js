const admin = require('../config/admin');
console.log(admin);
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const os = require('os');
const fs = require('fs');
const transliteretion = require('transliteration');
const asyncHandler = require('express-async-handler');
console.log('cont 0');
//const { Storage } = require('@google-cloud/storage');
//const formidable = require('formidable-serverless');                               
const { IncomingForm } = require('formidable-serverless');
const { time } = require('console');
const {constants} = require('../constants');

console.log('cont 1');

const db = admin.firestore();
//console.log(firebase.firestore.FieldValue.serverTimestamp());
console.log('cont 2');
//const storage = new Storage();
const bucket = admin.storage().bucket('news-images');
console.log('cont 3');

const createNewsArticle = asyncHandler(async (req, res) => {
    try {
        const form = new IncomingForm();

        // Parse the form data
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.status(400).send('Form parsing error');
                return;
            }
            const imageFile = files.image;
            const newsData = fields;
            const { title, content, category, ytVideoId, autherDetails } = newsData;
            if (!title || !content || !category || !imageFile) {
                res.status(400).json({ error: "All fields are mandatory" });
                return;
            }
            //const tempFilePath = path.join(os.tmpdir(), imageName);
            try {
                const slug = transliteretion.slugify(title, {
                    lowercase: true,
                    separator: '-',
                });
                console.log(admin);
                const imageName = `${uuidv4()}_${path.basename(slug)}.jpg`;

                //fs.renameSync(imageFile.path, tempFilePath);

                const storagePath = `news-images/${imageName}`;
                await bucket.upload(imageFile.path, {
                    destination: storagePath,
                    metadata: {
                        contentType: 'image/jpeg',
                    },
                });

                //fs.unlinkSync(tempFilePath);
                const timestamp = new Date();
                const newsRef = db.collection('News').doc();
                await newsRef.set({
                    title,
                    content,
                    slug,
                    imageUrl: `gs://${bucket.name}/${storagePath}`,
                    category,
                    // ytVideoId,
                    // autherDetails,
                    createdAt: timestamp,
                    views: 0
                });
            }
            catch (error) {
                console.error('Error creating news article:', error);
                throw error; // Rethrow the error to be caught by the outer try...catch
            } finally {
                // Clean up the temporary file, regardless of success or error
                fs.unlinkSync(imageFile.path);
            }
        });
        res.status(201).json({ success: 'news made successfully' });
    }
    catch (error) {
        console.log({ error: error });
    }

});
const getNewsArticles = asyncHandler(async (req, res) => {
    const { category, sortBy = 'date', sortOrder = 'desc' } = req.query;
    const page = Number(req.query.page) || 1;
    const pageSize = Number(req.query.pageSize) || 10;
    console.log({ category, sortBy, sortOrder });
    let query = db.collection('News');
    if (category) {
        query = query.where('category', '==', category);
    }

    if (sortBy === 'date') {
        query = query.orderBy('createdAt', sortOrder === 'asc' ? 'asc' : 'desc');
    }
    else if (sortBy === 'views') {
        query = query.orderBy('views', sortOrder === 'asc' ? 'asc' : 'desc');
    }

    const startAt = (page - 1) * pageSize;
    const sortedQuery = query.startAt(startAt).limit(pageSize);

    const newsSnapshot = await query.get();
    const querySnapshot = await db.collection('News').get();
    console.log(newsSnapshot);
    console.log(querySnapshot);
    const newsArticles = [];
    (newsSnapshot).forEach(doc => {
        const newsData = doc.data();
        console.log('forEach');
        newsArticles.push({
            id: doc.id,
            title: newsData.title,
            content: newsData.content,
            imageUrl: newsData.imageUrl,
            category: newsData.category,
            slug: newsData.slug,
        });
    });
    res.status(200).json(newsArticles);
});

const getNewsArticle = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const newsRef = db.collection('News').where('slug', '==', slug).limit(1);
    console.log('g1');

    // Use a transaction to increment the views field
    const newsArticle = await db.runTransaction(async (transaction) => {
        const newsSnapshot = await transaction.get(newsRef);
        console.log('g2');
        if (newsSnapshot.empty) {
            res.status(404).json({ error: "news article not found" });
            return;
        }

        const newsDoc = newsSnapshot.docs[0];
        const newsData = newsDoc.data();
        const imageName = newsData.imageUrl.split('/').pop();
        //const imageUrl = `https://storage.googleapis.com/${bucket.name}/news-images/${imageName}`;
        const imageUrl = await bucket.file(`news-images/${imageName}`).getSignedUrl({
            action: 'read',
            expires: Date.now() + 30 * 60 * 1000,
        });
        console.log('g3');
        // Increment views and update the document
        const updatedViews = (newsData.views || 0) + 1;
        transaction.update(newsDoc.ref, { views: updatedViews });
        console.log('g4');
        const newsArticle = {
            id: newsDoc.id,
            title: newsData.title,
            content: newsData.content,
            imageUrl: imageUrl,
            category: newsData.category,
            slug: newsData.slug,
            // Include other fields you want to expose
            views: updatedViews, // Include the updated views count
        };

        return newsArticle;
    });

    res.status(200).json(newsArticle);
});

const deleteNewsArticle = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const querySnapshot = await db.collection('News').where('slug', '==', slug).get();
    if (querySnapshot.empty) {
        res.status(404).json({ error: 'News article not found' });
        return;
    }
    let newsData;
    querySnapshot.forEach(async (doc) => {
        newsData = doc.data();
        await doc.ref.delete();
        const imageUrl = newsData.imageUrl;
        const imageName = imageUrl.split('/').pop();
        const imageRef = bucket.file(`news-images/${imageName}`);

        await imageRef.delete();
    });
    res.status(200).json({ message: 'News article and associated image deleted successfully' });

});

const modifyNewsArticle = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    try {
        const form = new IncomingForm();

        // Parse the form data
        form.parse(req, async (err, fields, files) => {
            if (err) {
                res.status(400).send('Form parsing error');
                return;
            }
            const imageFile = files.image;
            const newsData = fields;
            const { title, content, category, ytVideoId, authorDetails } = newsData;

            //const tempFilePath = path.join(os.tmpdir(), imageName);
            try {
                const newsQuerySnapshot = await db.collection('News').where('slug', '==', slug).get();

                if (newsQuerySnapshot.empty) {
                    res.status(404).json({ error: 'News article not found' });
                    return;
                }

                const newsDocRef = newsQuerySnapshot.docs[0].ref;
                const newsData = newsQuerySnapshot.docs[0].data();
                const updateData = {};
                let newImageName;
                if (title) {
                    updateData.title = title;
                    updateData.slug = transliteretion.slugify(title, {
                        lowercase: true,
                        separator: '-',
                    });
                    if (!imageFile) {
                        console.log('I1');
                        newImageName = `${uuidv4()}_${path.basename(updateData.slug)}.jpg`;
                        const imageUrl = newsData.imageUrl;
                        const oldImageName = imageUrl.split('/').pop();
                        const oldImageRef = bucket.file(`news-images/${oldImageName}`);
                        // const newStoragePath = `news-images/${newImageName}`
                        // //await bucket.file(oldImageRef).move(newStoragePath);
                        // const oldImage = bucket.file(oldImageRef);
                        // const newImageRef = `news-images/${newImageName}`;
                        // await oldImage.move(newImageRef);
                        console.log('I2');
                        try {
                            const oldImageFile = bucket.file(`news-images/${newsData.imageUrl.split('/').pop()}`);
                            const tempFilePath = path.join(os.tmpdir(), newImageName); // Temporary local path
                            console.log('I2.5');
                            await oldImageFile.download({ destination: tempFilePath });
                            console.log('I3');
                            // Upload the downloaded image with the new name
                            const storagePath = `news-images/${newImageName}`;
                            await bucket.upload(tempFilePath, {
                                destination: storagePath,
                                metadata: {
                                    contentType: 'image/jpeg',
                                },
                            });

                            // Delete the old image
                            await oldImageFile.delete();
                            fs.unlinkSync(tempFilePath);
                            // Update the imageUrl if needed
                            updateData.imageUrl = `gs://${bucket.name}/${storagePath}`;
                        } catch (error) {
                            console.error('Error renaming image:', error);
                            return; // Failed renaming
                        }
                    }

                }
                if (content) {
                    updateData.content = content;
                }
                if (category) {
                    updateData.category = category;
                }
                if (ytVideoId) {
                    updateData.ytVideoId = ytVideoId;
                }
                if (authorDetails) {
                    updateData.authorDetails = authorDetails;
                }

                if (imageFile) {
                    const storagePath = `news-images/${newImageName}`;
                    await bucket.upload(imageFile.path, {
                        destination: storagePath,
                        metadata: {
                            contentType: 'image/jpeg',
                        },
                    });
                    updateData.imageUrl = `gs://${bucket.name}/${storagePath}`;
                    const imageUrl = newsData.imageUrl;
                    const oldImageName = imageUrl.split('/').pop();
                    const imageRef = bucket.file(`news-images/${oldImageName}`);
                    await imageRef.delete();
                }

                await newsDocRef.update(updateData);

                res.status(200).json({ message: 'News article modified successfully' });
            } catch (error) {
                console.error('Error modifying news article:', error);
                res.status(500).json({ error: 'Internal server error' });
            } finally {
                // Clean up the temporary file, regardless of success or error
                if (imageFile)
                    fs.unlinkSync(imageFile.path);
            }
        });
    }
    catch (error) {
        console.log({ error: error });
    }
});

const getPopularNews = asyncHandler(async (req, res) => {
    try {
        const newsCollectionRef = db.collection('News');
        const popularNewsSnapshot = await newsCollectionRef.orderBy('views', 'desc').limit(8).get();
        
        const popularNews = await Promise.all(popularNewsSnapshot.docs.map(async doc => {
            const newsData = doc.data();
            const imageName = newsData.imageUrl.split('/').pop();
            const signedUrl = await bucket.file(`news-images/${imageName}`).getSignedUrl({
                action: 'read',
                expires: Date.now() + 15 * 60 * 1000, // URL expiration time (15 minutes in milliseconds)
            });

            return {
                id: doc.id,
                title: newsData.title,
                content: newsData.content,
                imageUrl: signedUrl[0], // Signed URLs are returned as an array
                category: newsData.category,
                slug: newsData.slug,
                // Include other fields you want to expose
            };
        }));

        res.status(200).json(popularNews);
    } catch (error) {
        console.error('Error fetching popular news:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

const getTrendingNewsArticles = asyncHandler(async (req, res) => {
    try {
        const currentDate = new Date();
        const timeFrame = constants.TIME_FRAME; // Set your desired time frame in milliseconds
        
        // Calculate the start date of the time frame
        const startDate = new Date(currentDate.getTime() - timeFrame);
        
        // Query the Firestore collection for news articles within the time frame
        const newsCollectionRef = db.collection('News');
        const trendingNewsSnapshot = await newsCollectionRef
            .where('createdAt', '>=', startDate)
            .where('createdAt', '<=', currentDate)
            .orderBy('createdAt', 'desc')
            .limit(6)
            .get();
        
            const trendingNews = [];
        
            for (const doc of trendingNewsSnapshot.docs) {
                const newsData = doc.data();
                const imageName = newsData.imageUrl.split('/').pop();
                const imageFile = bucket.file(`news-images/${imageName}`);
                
                // Get the signed URL for the image
                const signedUrls = await imageFile.getSignedUrl({
                    action: 'read',
                    expires: Date.now() + 15 * 60 * 1000, // URL expiration time (15 minutes in milliseconds)
                });
                
                const imageUrl = signedUrls[0]; // Use the first signed URL
                
                trendingNews.push({
                    id: doc.id,
                    title: newsData.title,
                    content: newsData.content,
                    imageUrl: imageUrl,
                    category: newsData.category,
                    slug: newsData.slug,
                    // Include other fields you want to expose
                });
            }
    

        res.status(200).json(trendingNews);
    } catch (error) {
        console.error('Error fetching trending news:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


const acceptForm = asyncHandler(async (req, res) => {
    const form = new IncomingForm();
    form.parse(req, async (err, fields, files) => {
        if (err) {
            res.status(400).send('Form parsing error');
            return;
        }
        console.log(new Date());
        const imageFile = files.image;
        console.log(imageFile.path);
        const newsData = fields;
        const { title, content, category } = newsData;
        console.log({ title, content, category });
        res.status(200).json(newsData);
    })
})



module.exports = { createNewsArticle, getNewsArticles, getNewsArticle, deleteNewsArticle, modifyNewsArticle, getPopularNews, getTrendingNewsArticles, acceptForm };