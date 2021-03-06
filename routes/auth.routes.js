const express = require('express');
const router  = express.Router();
const bcryptjs = require('bcrypt')
const saltRounds = 10;
const salt = bcryptjs.genSaltSync(saltRounds)
const mongoose = require('mongoose')
const fileUploader = require('../configs/cloudinary.config');
const Post = require('../models/Post.model');
const User = require('../models/User.model.js')

const routeGuard = require('../configs/route-guard.config');
const Offer = require('../models/Offer.model');


/* GET Signup */
router.get('/signup', (req, res, next) => {
  res.render('auth/signup');
});

router.post('/signup', fileUploader.single('photo'),(req, res,next)=> {
  console.log('values', req.body)
  const plainPassword = req.body.password
  const hashed = bcryptjs.hashSync(plainPassword,salt )
  console.log('hashed=', hashed)

 User.create({
   username: req.body.username, 
   email: req.body.email,
   city: req.body.city,
  //  mydescription: req.body.mydescription,
  //  myphoto: req.file.path,
   passwordHash: hashed,
   //transactions: '', // to get the numnber of transactions done 
   //mypoints: '' // to get the numnber of points collected
 }). then (userFromDb => {
   //res.send('user created')
   res.redirect('/login')
 }).catch(err => {
   console.log('💥 ', err);
 
    if (err instanceof mongoose.Error.ValidationError || err.code === 11000) {
    // re-afficher le formulaire

    console.log('Error de validation mongoose !')

    res.render('auth/signup', {
      errorMessage: 'Username and email not available'
    })
    } else {
    next(err) // hotline
    }
  })
})



//
// Log in route
//

router.get('/login', (req,res,next) => {
  res.render('auth/login')
})

router.post('/login',(req,res,next) => {
  const {email,password} = req.body;

  if (email === '' || password === '') {
    res.render('auth/login', {
      errorMessage: 'Please enter both, email and password to login.'
    });
    return;
  } 

  User.findOne({email})
    .then(user => {
      if(!user) {
        res.render('auth/login',  {errorMessage:'Email is not registered. Want to sign up?'})
        return; 
      }
        if (bcryptjs.compareSync(password,user.passwordHash)) {
          req.session.currentUser = user;
          res.redirect('/profile/myprofile');
        } else {
          res.render('auth/login', {errorMessage: 'Incorrect password'})
        }    
}).catch(err=>next(err))

});



//
//Profile's route
//
router.get('/profile/myprofile', (req, res, next) => {
  if (!req.session.currentUser) {
    res.redirect('/login')
    return;
  }

    Post.find({creatorId:req.session.currentUser._id}).sort({"createdAt": -1}) // keep _id to access the id
      .then(postsFromDb => {

        User.findById(req.session.currentUser._id).then(user => {
          res.render('profile/myprofile', {
            posts : postsFromDb,
            userInSession: user
          });
        }).catch(next)

        
  
      })
      .catch(next);
  // res.render('profile/myprofile', {userInSession: req.session.currentUser})

})

router.get('/profile/dashboard', (req, res, next) => {
  if (!req.session.currentUser) {
    res.redirect('/login')
  }

  const promises = [];

  promises.push(Offer.find({authorId:req.session.currentUser._id}).populate({path:'postId'}).populate({path:'creatorId'}).populate({path:'goodToExchange'}));
  promises.push(Offer.find({creatorId:req.session.currentUser._id}).populate({path:'postId'}).populate({path:'authorId'}).populate({path:'goodToExchange'}));

  Promise.all(promises).then(values => {
    // values: [[], []]
    values[0] // []
    values[1] // []
    
    User.findById(req.session.currentUser._id).then(user => {
      res.render('profile/dashboard', {
        requests: values[0],
        propositions: values[1],
        userInSession: user
      });
    }).catch(next)
  
  }).catch(next)
});

router.post('/offers/:id/response', (req, res, next) => {
  if (!req.session.currentUser) {
    res.redirect('/login')
  }
  console.log('req.body.response:   ',req.body.response)
  console.log('req.body.offer:   ',req.body.offer)
  console.log('typeof(req.body.offer):   ',typeof(req.body.offer))
  const id = req.params.id;
  let status;
  if (req.body.response === 'accepte') {
    status = 'Accepted';
  } else if (req.body.response === 'decline') {
    status = 'Declined';
  }
  let goodToExchange,pointsEstimate=0;
  if (req.body.offer ==='nothing') {
    goodToExchange = null;
  } else if (mongoose.Types.ObjectId.isValid(req.body.offer)){
    goodToExchange =req.body.offer;
  } else {
    pointsEstimate = req.body.offer;
  }
  
  console.log ('status:::',status)
  Offer.findByIdAndUpdate(id, {status:status,goodToExchange:goodToExchange,pointsEstimate:pointsEstimate},{new:true}).populate('creatorId').populate('authorId')
    .then(offerUpdated => {
      if (status==='Accepted') {
        const promises = [];
        promises.push(User.findOneAndUpdate(
          {_id:offerUpdated.creatorId.id},
          {$inc: { transactions: 1, mypoints: Number(pointsEstimate)+1} },
          {new:true}
          ));
        promises.push(User.findOneAndUpdate(
          {_id:offerUpdated.authorId.id},
          {$inc: { transactions: 1, mypoints: -Number(pointsEstimate)+1} },
          {new:true}
        ));
        Promise.all(promises).then(values => res.redirect('/profile/dashboard')).catch(next)
      } else {
        User.updateMany(
          {_id: {$in: [offerUpdated.creatorId.id,offerUpdated.authorId.id]}},
          {new:true}
          ).then (userfromdb => {
            console.log('user:  ',userfromdb);
            res.redirect('/profile/dashboard');
          })
          .catch(next);
      }
    })
    .catch(next);


});

//modifier le profil 
router.get('/profile/myprofile-edit', (req, res, next) => {
  User.findOne({_id: req.session.currentUser._id})
    .then(userInSession => {
      console.log('userInSession    ',userInSession)
      res.render('profile/myprofile-edit', {userInSession})
    })
    .catch(err => next(err))
  ;
});

router.post('/profile/myprofile-edit', fileUploader.single('photo'), (req, res, next) => {
  User.findById(req.session.currentUser._id)
    .then(userFromDb => {
      let myphoto = userFromDb.myphoto;
      if (req.file) {
      myphoto=req.file.path
      }
      console.log('myphoto:    ',myphoto)
      console.log('userFromDb.myphoto     ',userFromDb.myphoto)
      console.log('req.file   ',req.file)
      User.findByIdAndUpdate({ _id: userFromDb.id }, {
        myphoto: myphoto,
        city: req.body.city,
        mydescription : req.body.mydescription
      }, {new: true})
        .then(currentUserUpdated => 
          // {console.log('test');
          res.redirect('/profile/myprofile')
          // res.render('profile/myprofile', 
          // {userInSession: currentUserUpdated}
          //)
        // }
          
        )
        .catch(err => next(err))
    })
    .catch(err=>next(err))
  // const {city, mydescription} = req.body;
  // console.log('dans edit')
  // console.log(process.env.CLOUDINARY_KEY)
  // console.log(req.session.currentUser)
  // let myphoto = req.session.currentUser.myphoto;
  // if (req.file) {
  //  myphoto=req.file.path
  // }
  // console.log('myphoto:    ',myphoto)
  // console.log('req.session.currentUser.myphoto     ',req.session.currentUser.myphoto)
  // console.log('req.file   ',req.file)
  // User.findByIdAndUpdate({ _id: req.session.currentUser._id }, {
  //   myphoto: myphoto,
  //   city: req.body.city,
  //   mydescription : req.body.mydescription
  // }, {new: true})
  //   .then(currentUserUpdated => 
  //     // {console.log('test');
  //     res.redirect('/profile/myprofile')
  //     // res.render('profile/myprofile', 
  //     // {userInSession: currentUserUpdated}
  //     //)
  //   // }
      
  //   )
  //   .catch(err => next(err))
  })



//Afficher le profile d'un user quelconque
router.get('/profile/:profileid', (req, res, next) => {
  User.findOne({_id: req.params.profileid})
  .then(user => { 
    const id = user.id;
    Post.find({creatorId:id})
    .then (posts => {
      if (req.session.currentUser._id===req.params.profileid) {
        res.redirect('/profile/myprofile')
      } else {
        res.render('profile/profile', {
          userInSession: req.session.currentUser,
          user: user,
          posts: posts
        })
        }   
    })
    .catch(err => next(err))
    
  })
  .catch(err => next(err))
  });




router.post('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});
module.exports = router;
