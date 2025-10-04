import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/user.model.js";
import { _config } from "./config.js";

export default function configurePassport(passport) {
    passport.use(
        new GoogleStrategy(
            {
                clientID: _config.GOOGLE_CLIENT_ID,
                clientSecret: _config.GOOGLE_CLIENT_SECRET,
                callbackURL: _config.GOOGLE_CALLBACK_URL,
                proxy: true
            },
            async (accessToken, refreshToken, profile, done) => {
                try {
                    // Check if user exists
                    console.log('Google authentication attempt for user:', profile.id);

                    let user = await User.findOne({ googleId: profile.id });
                    if (!user) {
                        // Create new user
                        user = await User.create({
                            firstname: profile.name.givenName,
                            lastname: profile.name.familyName,
                            email: profile.emails[0].value,
                            profile: profile.photos[0].value,
                            googleId: profile.id
                        });
                    }

                    console.log('User authenticated successfully:', user);

                    return done(null, user);
                } catch (err) {
                    console.error('Error in Google authentication:', err);
                    return done(err, false);
                }
            }
        )
    );


    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    passport.deserializeUser(async (id, done) => {
        try {
            const user = await User.findById(id);
            done(null, user);
        } catch (err) {
            done(err, null);
        }
    });
}