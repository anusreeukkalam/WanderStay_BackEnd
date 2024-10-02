const express=require('express');
const cors=require('cors');
const mongoose= require('mongoose');
const bcrypt=require('bcrypt');
const User=require('./models/User.js')
require('dotenv').config();
const app=express();
const bcryptSalt=bcrypt.genSaltSync(10);
const jwt=require('jsonwebtoken');
const jwtSecret='hiwriwuebf8fef0j2nejb1hibhi';
const cookieParser=require('cookie-parser');
const Place=require('./models/Place.js');
const imageDownloader=require('image-downloader');
const multer=require('multer');{/*for uploading files from our system */}
const fs=require('fs');
const path=require('path');
const Booking=require('./models/Booking.js');

{/* middlewares*/}
app.use(express.json());
app.use(cookieParser());
app.use('/uploads',express.static(__dirname+'/uploads'));
app.use(cors({
    credentials:true,
    origin:'https://wanderstay-frontend-tvgv.onrender.com', //specifies what kind of is able to communicate with our api
}));

mongoose.connect(process.env.MONGO_URL,{
  serverSelectionTimeoutMS: 5000 // Reduce timeout to 5 seconds
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Connection error', err.message);
});

function  getUserDataFromReq(req){
  return new Promise ((resolve,reject)=>{
    jwt.verify(req.cookies.token,jwtSecret,{},async(err,userData)=>{
      if(err) throw err;
      resolve(userData);
     });
  });
}

{/*http requests for each page*/}
app.get('/test',(req,res)=>{
  res.json('test ok');
});

app.post('/register',async (req,res)=>{
  const {name,email,password}=req.body;
try{
  const userDoc= await User.create({
    name,
    email,
    password:bcrypt.hashSync(password,bcryptSalt),
  });
  res.json(userDoc);
}
catch(e){
res.status(422).json(e);
}
});

app.post('/login',async (req,res)=>{
 const {email,password}=req.body;
  const userDoc= await User.findOne({email});
  if(userDoc){
   const passOk=bcrypt.compareSync(password,userDoc.password);
     if(passOk)
     {
    jwt.sign({
      email:userDoc.email,
      id:userDoc._id
    },jwtSecret,{},(err,token)=>{
     if(err) {
         res.status(500).json({message: 'Internal Server Error'});
         throw err;
     }
     res.cookie('token',token,{
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production', // Only secure in production
         sameSite: 'None',
     }).json(userDoc);
     });
     }else{
     res.status(422).json('Invalid Password')
     }
  }
  else
   {
    res.status(404).json('User not found');
   }
});

app.get('/profile',(req,res)=>{
  const {token}=req.cookies;
  if(!token){
     return res.status(401).json('No token provided');
  }
  jwt.verify(token,jwtSecret,{},async (err,userData)=>{
    if(err){
      return res.status(403).json('Invalid token');
    }
    const {name,email,_id}= await User.findById(userData.id);
    res.json({name,email,_id});
  });
});

app.post('/logout', (req,res)=>{
   res.cookie('token','').json(true);
});

app.post('/upload-by-link', async (req,res)=>{
 /*const {link}=req.body; 
 const newName='photo'+Date.now()+'.jpg';
 await imageDownloader.image({
  url:link,
  dest:__dirname+'/uploads/'+newName,
 })
  res.json(newName);*/
    res.json(link);
});

const photosMiddleware=multer({dest:'uploads/'});

app.post('/upload',photosMiddleware.array('photos',100),(req,res)=>{
  const uploadedFiles=[];
  for(let i=0;i<req.files.length;i++){
    const {path:tempPath,originalname}=req.files[i];
    const ext=path.extname(originalname);
    const newPath=tempPath+ext;
    fs.renameSync(tempPath,newPath);
    uploadedFiles.push(path.basename(newPath));
  }
  res.json(uploadedFiles);
  
});

app.post('/places',(req,res)=>{
  const {token}=req.cookies;
  const {
    title,address,addedPhotos,description,perks,extraInfo,checkIn,checkOut,price,maxGuests  
        }=req.body;
  jwt.verify(token,jwtSecret,{},async (err,userData)=>{
    if(err){
      return res.status(403).json('Invalid token');
    }
    const placeDoc= await Place.create({
      owner:userData.id,
      title,
      address,
      photos: addedPhotos,
      description,
      perks,
      extraInfo,
      checkIn,
      checkOut,
      price,
      maxGuests
     });
    res.json(placeDoc);
  });
});

app.get('/user-places',(req,res)=>{
   const {token}=req.cookies;
   jwt.verify(token,jwtSecret,{},async (err,userData)=>{
    const {id}=userData;
    res.json(await Place.find({owner:id}));
   });
});

app.get('/places/:id',async (req,res)=>{
  const {id}=req.params;
  try{
    const place=await Place.findById(id);
    if(!place){
      return res.status(404).json({error:'place not found'});
    }
    res.json(place);
  }
  catch(error){
    res.status(500).json({error:'server error'});
  } 
});

app.put('/places',async(req,res)=>{
  const {token}=req.cookies;
  const {
          id,title,address,addedPhotos,description,perks,extraInfo,checkIn,checkOut,price,maxGuests  
        }=req.body;
        jwt.verify(token,jwtSecret,{},async (err,userData)=>{
          const placeDoc=await Place.findById(id);
          if(userData.id===placeDoc.owner.toString()){
            placeDoc.set({
              title,
              address,
              photos: addedPhotos,
              description,
              perks,
              extraInfo,
              checkIn,
              checkOut,
              price,
              maxGuests
            })
            await placeDoc.save();
             res.json('ok');
          }
    });
});

app.get('/places',async(req,res)=>{
  res.json(await Place.find());
});

app.post('/bookings',async(req,res)=>{
  const userData = await getUserDataFromReq(req);
  const {
    place,checkIn,checkOut,numberOfGuests,name,phone,price
        }=req.body;
  Booking.create({
    place,checkIn,checkOut,numberOfGuests,name,phone,price,
    user:userData.id,
   }).then((doc )=>{
      res.json(doc);
   }).catch((err)=>{
      throw err;
   })
});

app.get('/bookings',async(req,res)=>{
  const userData = await getUserDataFromReq(req);
 res.json(await Booking.find({user:userData.id}).populate('place'));
  
});

{/*backend server port */}
app.listen(4000);
