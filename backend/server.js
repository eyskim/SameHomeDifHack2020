const express = require("express");
const request = require("request");
const cors = require("cors");
const mongoose = require("mongoose");

const passport = require("passport");
const findOrCreate = require("mongoose-findorcreate");
const cookieSession = require("cookie-session");

const LinkedInStrategy = require("passport-linkedin-oauth2").Strategy;

const app = express();
const port = process.env.PORT || 5000;
const path = require("path");

// server settings - make sure that your port doesn't conflict with the React port!
app.use(cors());
app.use(express.json());
require("dotenv").config();

// MongoDB configuration
const users = require("./models/users.model");
const { profileEnd } = require("console");

const uri = process.env.ATLAS_URI;
mongoose.connect(uri, {
  useUnifiedTopology: true,
  useNewUrlParser: true,
  useCreateIndex: true,
});

const connection = mongoose.connection;
connection.once("open", () => {
  console.log("MongoDB database connection established successfully");
});

//CookieSession Configuration
app.use(
  cookieSession({
    maxAge: 7 * (24 * 60 * 60 * 1000), // One day in milliseconds
    keys: ["SOME TEMP PLACEHOLDER"], // secret key to hash cookie
  })
);

app.use(passport.initialize()); // Used to initialize passport
app.use(passport.session()); // Used to persist login sessions

app.get("/", function (req, res) {
  res.send("server success");
});

//LinkedIn Strategy
const LinkedOAuthProduction = new LinkedInStrategy(
  {
    clientID: "86fr1qhkghwu6j",
    clientSecret: "UJEq5LFDVX7Y5WVa",
    callbackURL: "http://localhost:5000/auth/linkedin/callback",
    scope: ["r_emailaddress", "r_liteprofile", "w_member_social"],
    state: true,
  },
  function (accessToken, refreshToken, profile, done) {
    // process.nextTick(function () {
    //   return done(null, profile);
    // });
    console.log(profile);
    users.findOrCreate(
      { email: profile.emails[0].value },
      {
        id: profile.id,
        displayName: profile.displayName,
        picture: profile.picture,
        headline: profile.headline,
        interests: profile.interests,
      },
      function (err, user) {
        user.picture = profile.photos[3].value;
        user.email = profile.emails[0].value;
        user.displayName = profile.displayName;
        user.headline = "It's a Big World";
        user.interests = [];
        user.save();
        done(err, user.email);
      }
    );
  }
);

passport.use(LinkedOAuthProduction);

// Used to stuff a piece of information into a cookie
passport.serializeUser((user, done) => {
  done(null, user);
});

// Used to decode the received cookie and persist session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Middleware to check if the user is authenticated
function isUserAuthenticated(req, res, next) {
  console.log(req.user);
  if (req.user) {
    next();
  } else {
    res.send("You must login!");
  }
}

//  using this to retrieve user data from the Passport 'profile' object
app.get("/userdata", isUserAuthenticated, (req, res) => {
  users.find({ email: req.user }, function (err, result) {
    console.log(result);
    res.send(result);
  });
});

// need to debug and test - this route should be a post request to ask to delete user profile
app.post("/deleteUser", isUserAuthenticated, (req, res) => {
  users.findOne({ email: req.user }).then((user) => {
    user
      .delete()
      .then(() => {
        console.log("Deleted user successfully");
        res.sendStatus(204);
      })
      .catch((err) => {
        console.log(err);
        res.sendStatus(404);
      });
  });
});

// Logout route
app.get("/logout", (req, res) => {
  req.logout();
  res.redirect("/");
});

// Secret route
app.get("/secret", isUserAuthenticated, (req, res) => {
  res.send("You have reached the secret route");
});

// passport.authenticate middleware is used here to authenticate the request for linkedin
app.get(
  "/auth/linkedin",
  passport.authenticate("linkedin", function (req, res) {
    //scope: ["(no scope)"],
    //scope: ["r_emailaddress", "r_liteprofile"], // Used to specify the required data; we only want read-only access to public information
  })
);

// GET /auth/linkedin/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function function will be called,
//   which, in this example, will redirect the user to the home page.
app.get(
  "/auth/linkedin/callback",
  passport.authenticate("linkedin", { failureRedirect: "/login" }),
  (req, res) => {
    console.log("Successfully logged in");
    res.redirect("/secret");
  }
);

app.post("/users/add", (req, res) => {
  const { id, name, email, location, introduction, skills, ideas } = req.body;

  const newUser = new users({
    id,
    name,
    email,
    location,
    introduction,
    skills,
    ideas,
  });

  newUser
    .save()
    .then(() => res.json("New user is added!"))
    .catch((err) => res.status(400).json("Error: " + err));
});

app.get("/users/:id", (req, res) => {
  users
    .findById(req.params.id)
    .then((user) => res.json(user))
    .catch((err) => res.status(400).json("Error: " + err));
});

const getOption = (text1, text2) => {
  const option = {
    method: "GET",
    url: "https://twinword-text-similarity-v1.p.rapidapi.com/similarity/",
    qs: {
      text1: text1,
      text2: text2,
    },
    headers: {
      "x-rapidapi-host": "twinword-text-similarity-v1.p.rapidapi.com",
      "x-rapidapi-key": "f3512dba28msha0bfafff623f90fp18ccabjsn78a20a660e54",
      useQueryString: true,
    },
  };
  return option;
};

const options = {
  method: "GET",
  url: "https://twinword-text-similarity-v1.p.rapidapi.com/similarity/",
  qs: {
    text1:
      "The hippocampus is a major component of the brains of humans and other vertebrates. It belongs to the limbic system and plays important roles in the consolidation of information from short-term memory to long-term memory and spatial navigation. Humans and other mammals have two hippocampi%2C one in each side of the brain. The hippocampus is a part of the cerebral cortex%3B and in primates it is located in the medial temporal lobe%2C underneath the cortical surface. It contains two main interlocking parts%3A Ammon's horn and the dentate gyrus.",
    text2:
      "An important part of the brains of humans and other vertebrates is the hippocampus. It's part of the limbic system and moves information from short-term to long-term memory. It also helps us move around. Humans and other mammals have two hippocampi%2C one on each side. The hippocampus is a part of the cerebral cortex%3B and in primates it is found in the medial temporal lobe%2C beneathe the cortical surface. It has two main interlocking parts%3A Ammon's horn and the dentate gyrus.",
  },
  headers: {
    "x-rapidapi-host": "twinword-text-similarity-v1.p.rapidapi.com",
    "x-rapidapi-key": "f3512dba28msha0bfafff623f90fp18ccabjsn78a20a660e54",
    useQueryString: true,
  },
};

app.get("/matching", (req, res) => {
  request(options, function (error, response, body) {
    if (error) throw new Error(error);
    console.log(body);
  });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
