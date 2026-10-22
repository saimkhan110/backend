// STEP 3: User Schema (user collection in MongoDB)
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs'); // library used to hash passwords
const UserSchema = new mongoose.Schema(
{
name: {
type: String,
required: [true, 'Name is required'],
trim: true
},
email: {
type: String,
required: [true, 'Email is required'],
unique: true, // duplicate emails are not allowed
lowercase: true, // store email in lowercase
trim: true
},
password: {
type: String,
required: [true, 'Password is required'],
minlength: [6, 'Password must be at least 6 characters'],
select: false // hidden by default in API responses (security)
},
role: {
type: String,
enum: ['user', 'admin'], // only these two roles are allowed
default: 'user' // every new user starts with the 'user' role
},
isActive: {
type: Boolean,
default: true
}
},
{
timestamps: true // adds createdAt / updatedAt automatically
}
);
// Pre-save hook: the password is hashed BEFORE the user document is saved
// It runs automatically on User.create() and user.save()
UserSchema.pre('save', async function () {
  // Skip hashing if the password hasn't changed
  if (!this.isModified('password')) {
    return;
  }

  // Generate a salt
  const salt = await bcrypt.genSalt(10);

  // Hash the password
  this.password = await bcrypt.hash(this.password, salt);
});
// Instance method: compares the entered password at login time
// Usage on a user document: user.comparePassword('abc123')
UserSchema.methods.comparePassword = async function (enteredPassword) {
// bcrypt hashes the entered password and compares it with the stored hash
return await bcrypt.compare(enteredPassword, this.password);
};
const User = mongoose.model('User', UserSchema);
module.exports = User;
