const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const User = require("../models/user");
const Buy = require("../models/buy");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const mongoose = require("mongoose");
const forgetPassword = require("../models/forgetPassword");
const userWallet = require("../models/userWallet");

app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

function randomString(length, chars) {
  var mask = "";
  if (chars.indexOf("a") > -1) mask += "abcdefghijklmnopqrstuvwxyz";
  if (chars.indexOf("A") > -1) mask += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (chars.indexOf("#") > -1) mask += "0123456789";
  if (chars.indexOf("!") > -1) mask += "~`!@#$%^&*()_+-={}[]:\";'<>?,./|\\";
  var result = "";
  for (var i = length; i > 0; --i)
    result += mask[Math.floor(Math.random() * mask.length)];
  return result;
}

async function sendMail(subject, message) {
  var transporter = nodemailer.createTransport({
    host: "mail.hrlw.in",
    port: 465,
    auth: {
      user: "analog@hrlw.in",
      pass: "Analog@123",
    },
  });

  var mailOptions = {
    from: "analog@hrlw.in",
    to: "vipinatraura@gmail.com",
    subject: subject,
    html: message,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.log(error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

exports.sendotp = async (req, res) => {
  if (req.body.email == "") {
    return res.status(400).json({
      status: "false",
      message: "Email field Cannot be Blank",
    });
  } else {
    var otp = Math.floor(Math.random() * 1000000 + 1);
    var subject = "Varify your Email";
    var message =
      "<h1>Wecome to Analog, <br> To Varify your email on Analog. Your OTP is : <br>" +
      otp +
      "</h1>";
    let varify = await User.updateOne(
      { email: req.body.email },
      { $set: { otp: otp } }
    );
    if (varify) {
      sendMail(subject, message);
      return res.status(200).json({
        status: 1,
        message: "OTP sended successfully",
      });
    } else {
      return res.status(400).json({
        status: 0,
        message: "Something went wrong",
      });
    }
  }
};

function checkEmail(email) {
  const emailToValidate = email ? email : "";
  const emailRegexp =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  const res = emailRegexp.test(emailToValidate);
  console.log("CHECK EMAIL : ", res);
  return res;
}

function checkPassword(password) {
  console.log("Password: ", password);
  const passwordToValidate = password ? password : "";
  const passwordRegexp =
    /(?=^.{8,15}$)((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[0-9])(?=.*[@_*&.])(?=.*[a-z]).*$/;
  const res = passwordRegexp.test(passwordToValidate);
  console.log("Check Password: ", res);
  return res;
}

exports.signup = async (req, res) => {
  const email               = req.body.email ? req.body.email : "";
  const password            = req.body.password ? req.body.password : "";
  const confirmPassword     = req.body.confirm_password? req.body.confirm_password : "";
  const referral_code       = req.body.referral_code;
  if (confirmPassword !== password) {
    return res.json({
      status: 0,
      message: "Password and confirm password do not Match",
    });
  }

  //return res.send("executed..");
  if (email && checkEmail(email) && password) {
    try {
      await User.findOne({ email: email }).exec(async (error, user) => {
        if (user) {
          return res.json({
            status: -1,
            message: "User is already exist",
          });
        } else {
          var otp = Math.floor(Math.random() * 1000000 + 1);
          const user_id = "ANA" + Math.floor(Math.random() * 10000000 + 1);
          const signup_bonus = 500;
          const _user = new User({
            email             : req.body.email,
            user_id           : user_id,
            password          : req.body.password,
            refferal          : req.body.referral_code,
            signup_bonus      : signup_bonus,          
            otp: otp,
          });

          _user.save((error, data) => {
            if (error) {
              console.log("Error in Sign Up", error.message);
                  return res.status(400).json({
                    status: 0,
                    message: "Somthing went wrong",
                  });
            } else if (data) {
                    createWallet(email);
                    var subject = "Registration completed successully";
                    var message = "<h1>Hello Rahul, <br> Your have Registerd successully on Analog. Your OTP is : <br>" +                 otp +
                      "</h1>";
                    sendMail(subject, message);
                    return res.status(200).json({
                      status: 1,
                      message: "User Sign Up successfully",
                    });
            }
          });
        }
      });
    } catch (error) {
      console.log("Error in Sign Up ", error.message);
    }
  } else {
    return res.status(400).json({
      status: 0,
      message: "somthing went wrong",
    });
  }
};

exports.signin = async (req, res) => {
  console.log(req.body);
  const email = req.body.email ? req.body.email : "";
  const password = req.body.password ? req.body.password : "";
  if (email && checkEmail(email) && password) {
    try {
      await User.findOne({ email: email }).exec(async (error, user) => {
        if (error) {
          return res.status(400).json({
            status: 4,
            message: "Email not registered",
          });
        }
        if (user) {
          console.log(user);
          const { _id, email, password, isVarify } = user;

          if (bcrypt.compareSync(req.body.password, password)) {
            if (isVarify == 0) {
              return res.status(400).json({
                status: 3,
                message: "OTP is not varified",
              });
            }
            const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET, {
              expiresIn: "1h",
            });
            res.status(200).json({
              status: 1,
              token: token,
              user: _id,
              email: email,
              message: "Login Successful",
            });
          } else {
            return res.status(400).json({
              status: 0,
              message: "Password do not match",
            });
          }
        } else {
          return res.status(400).json({
            status: 4,
            message: "Email Not exist",
          });
        }
      });
    } catch (error) {
      console.log("Error in Sign in ", error.message);
      return res.status(200).json({
        status: 0,
        msg: "Something Went Wrong",
      });
    }
  }
};

exports.varify = async (req, res) => {
  const email = req.body.email ? req.body.email : "";
  const otp = req.body.otp ? req.body.otp : "";
  if (email && otp != "") {
    try {
      await User.findOne({ email: req.body.email }).exec(
        async (error, user) => {
          if (error)
            return res.status(400).json({
              status: 0,
              message: "Something Went Wrong",
            });
          if (user) {
            const { _id, email, otp } = user;
            if (otp == req.body.otp) {
              let varify = await User.updateOne(
                { email: email },
                { $set: { isVarify: 1 } }
              );
              if (varify) {
                console.log(varify);
                console.log(email);
                res.status(200).json({
                  status: 1,
                  message: "OTP Varyfied successully",
                });
              } else {
                res.status(200).json({
                  status: 0,
                  message: "Something went wrong",
                });
              }
            } else {
              return res.status(400).json({
                status: "false",
                message: "Incorrect OTP",
              });
            }
          } else {
            return res.status(400).json({
              status: "false",
              message: "Invalide User",
            });
          }
        }
      );
    } catch (error) {
      console.log("Error in Sign in ", error.message);
      return res.status(200).json({
        status: "false",
        msg: "Something Went Wrong",
      });
    }
  } else {
    return res.status(400).json({
      status: 0,
      message: "Email and OTP field cannot be blank",
    });
  }
};

exports.forgetPassword = async (req, res) => {
  if (req.body.email == "") {
    return res.status(400).json({
      status: 0,
      message: "Email field Cannot be Blank",
    });
  } else {
    try {
      await User.findOne({ email: req.body.email }).exec(
        async (error, user) => {
          if (user) {
            var randCode = randomString(20, "aA");
            var subject = "Reset your password";
            var msg = `<h1>Hello Rahul, <br> Click on the reset button below to reset your password.<br> <a href='http://localhost:3000/ResetPassword?resetcode=${randCode}' > Reset </a></h1>`;
            // var msg = "http://localhost:3000/ResetPassword?restcode=123456";
            _forgetPass = new forgetPassword({
              email: req.body.email,
              forgetString: randCode,
            });
            _forgetPass.save((err, data) => {
              if (err) {
                return res.status(400).json({
                  status: 0,
                  message: "Something went wrong",
                });
              }
              if (data) {
                sendMail(subject, msg);
                return res.status(200).json({
                  status: 1,
                  message: "Reset link is sended",
                });
              }
            });
          } else {
            return res.status(400).json({
              status: 4,
              message: "Email is not registerd",
            });
          }
        }
      );
    } catch (error) {
      console.log("Error in Sign in ", error.message);
      return res.status(200).json({
        status: 0,
        msg: "Something Went Wrong",
      });
    }
  }
};

exports.resetPassword = async (req, res) => {
  if (req.body.resetCode == "") {
    return res.status(400).json({
      status: 0,
      message: "Invalid Access...",
    });
  } else if (req.body.password == "") {
    return res.status(400).json({
      status: 0,
      message: "Password field Cannot be Blank",
    });
  } else if (req.body.confirmPassword == "") {
    return res.status(400).json({
      status: 0,
      message: "Confirm password field Cannot be Blank",
    });
  } else if (req.body.password != req.body.confirmPassword) {
    return res.status(400).json({
      status: 0,
      message: "Password and confirm password cannot match",
    });
  } else {
    try {
      await forgetPassword
        .findOne({ forgetString: req.body.resetCode, status: 0 })
        .exec(async (err, fdata) => {
          if (err) {
            return res.status(400).json({
              status: 0,
              message: "Something went wrong",
            });
          }
          if (fdata) {
            const { _id, email } = fdata;
            await forgetPassword.updateOne(
              { _id: _id },
              { $set: { status: 1 } }
            );
            await User.findOne({ email: email, status: 1 }).exec(
              async (error, user) => {
                if (user) {
                  //console.log("exe..1");
                  const hashPass = bcrypt.hashSync(req.body.password, 10);
                  let passwordUpdate = await User.updateOne(
                    { email: email },
                    { $set: { password: hashPass } }
                  );

                  if (passwordUpdate) {
                    var subject = "Password changed successfully";
                    var message =
                      "<h1>Hello Rahul, <br> Your password has been updated successfully.</h1>";
                    sendMail(subject, message);
                    return res.status(200).json({
                      status: 1,
                      message: "Password updated successully...",
                    });
                  } else {
                    return res.status(400).json({
                      status: 0,
                      message: "Something went wrong",
                    });
                  }
                } else {
                  return res.status(400).json({
                    status: 0,
                    message: "Something went wrong",
                  });
                }
              }
            );
          }
        });
    } catch (error) {
      console.log("Error in Reset Password in ", error.message);
      return res.status(200).json({
        status: 0,
        msg: "Something Went Wrong",
      });
    }
  }
};


async function createWallet(email) {
  const btc_wallet        = await createBTCAddress();
  const eth_wallet        = await createETHAddress();
  const trx_wallet        = await createTRXAddress();
  const solana_wallet     = await createSolanaAddress();
 
  // 1 BTC wallet
  const btcWallet = new userWallet({       
      email           : email,
      walletAddr      : btc_wallet.address,
      privateKey      : btc_wallet.privateKey,
      walleType       : btc_wallet.type,
      symbol          : btc_wallet.symbol
  });
  btcWallet.save();

  // 2) INRX, ETH, BUSD,  BNB, SHIBA, MATIC
  const inrxWallet = new userWallet({    
      email           : email,
      walletAddr      : eth_wallet.address,
      privateKey      : eth_wallet.privateKey,
      walleType       : "INRX",
      symbol          : "INRX"
  });
  inrxWallet.save();

  const ethWallet = new userWallet({    
      email           : email,
      walletAddr      : eth_wallet.address,
      privateKey      : eth_wallet.privateKey,
      walleType       : "Etherium",
      symbol          : "ETH"
  });
  ethWallet.save();

  const busdWallet = new userWallet({    
      email           : email,
      walletAddr      : eth_wallet.address,
      privateKey      : eth_wallet.privateKey,
      walleType       : "BUSD",
      symbol          : "BUSD"
  });
  busdWallet.save();

  const bnbWallet = new userWallet({    
      email           : email,
      walletAddr      : eth_wallet.address,
      privateKey      : eth_wallet.privateKey,
      walleType       : "BNB",
      symbol          : "BNB"
  });
  bnbWallet.save();

  const shibaWallet = new userWallet({    
      email           : email,
      walletAddr      : eth_wallet.address,
      privateKey      : eth_wallet.privateKey,
      walleType       : "SHIBA",
      symbol          : "SHIBA"
  });
  shibaWallet.save();

  const maticWallet = new userWallet({    
      email           : email,
      walletAddr      : eth_wallet.address,
      privateKey      : eth_wallet.privateKey,
      walleType       : "Matic",
      symbol          : "MATIC"
  });
  maticWallet.save();
  
  // 3) USDT, TRX 
  const usdtWallet = new userWallet({    
      email           : email,
      walletAddr      : trx_wallet.address,
      privateKey      : trx_wallet.privateKey,
      walleType       : "USDT",
      symbol          : "USDT"
  });
  usdtWallet.save();

  const trxWallet = new userWallet({    
      email           : email,
      walletAddr      : trx_wallet.address,
      privateKey      : trx_wallet.privateKey,
      walleType       : "TRON",
      symbol          : "TRX"
  });
  trxWallet.save();

  // 4) SOLANA
  const solanaWallet = new userWallet({    
      email           : email,
      walletAddr      : solana_wallet.address,
      privateKey      : solana_wallet.privateKey,
      walleType       : "SOLANA",
      symbol          : "SOL"
  });
  solanaWallet.save();
}

async function createBTCAddress() {
  const bitcore = require('bitcore-lib');
  const privateKey = new bitcore.PrivateKey();
  var address = privateKey.toAddress();
  if (bitcore.PrivateKey.isValid(privateKey)) {
      address = bitcore.Address.isValid(address) ? address : undefined;
  }
  if (address !== undefined) {
      return ({
          address: address.toString(),
          privateKey: privateKey.toString(),
          type: "BITCOIN",
          symbol: 'BTC'
      })
  } else {
      return ({
          address: "",
          privateKey: "",
          type: "",
          symbol: ''
      })
  }
}

async function createETHAddress() {
  const ethWallet = require('ethereumjs-wallet');
  console.log(ethWallet.default)
  const address = ethWallet.default.generate();
  if (address !== undefined) {
      console.log(address);
      return ({
          address: address.getAddressString(),
          privateKey: address.getPrivateKeyString(),
          type: "ethereum",
          symbol: 'ETH'
      })
  } else {
      return ({
          address: "",
          privateKey: "",
          type: "",
          symbol: ''
      })
  }
}
async function createTRXAddress() {
  const TronWeb = require('tronweb');
  let wallet = TronWeb.utils.accounts.generateAccount();
  if (wallet && wallet.address && wallet.address.base58 && wallet.privateKey) {
      return ({
          address: wallet.address.base58,
          privateKey: wallet.privateKey,
          type: "TRON",
          symbol: 'TRX'
      })
  } else {
      return ({
          address: "",
          privateKey: "",
          type: "",
          symbol:''
      })
  }

}

async function createSolanaAddress() {
  const solanaWallet = require('@solana/web3.js');
  var keyPair = solanaWallet.Keypair.generate(); 
  var address = keyPair.publicKey.toString(); 
  var privateKey = "["+keyPair.secretKey.toString()+"]";
  // console.log(address.secretKey);
  if (address !== undefined) {
      console.log(address);
      return ({
          address: address,
          privateKey: privateKey,
          type: "SOLANA",
          symbol: "SOL"
      })
  } else {
      return ({
          address: "",
          privateKey: "",
          type: "",
          symbol: ''
      })
  }
}


exports.walletData = async (req, res) => {
  try {
    const { email } = req.body;
    const walletData = await userWallet.find({ email });
    if (walletData) {
      return res.status(200).json(walletData);
    } else {
      return res
        .status(400)
        .json({ message: "something went wrong. member not found." });
    }
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};


