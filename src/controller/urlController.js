const urlModel = require("../models/urlModel")
const validator = require("validator")
const shortid = require("shortid")
const redis = require("redis")
const { promisify } = require("util")
const baseUrl = "http://localhost:3000/"

const redisClient = redis.createClient(
    17269,
    "redis-17269.c264.ap-south-1-1.ec2.cloud.redislabs.com"
    
);

redisClient.auth("L9uCuh4Xbc3rXguxyUH9LQUOwl3UlXU1", function (err) {
    if (err) throw err;
});

redisClient.on("connect", async function () {
    console.log("Connected to Redis..");
});

const SETEX_ASYNC = promisify(redisClient.SETEX).bind(redisClient)
const GETEX_ASYNC = promisify(redisClient.GETEX).bind(redisClient)

const createUrl = async function (req, res) {
    try {
        const data= req.body;
         longUrl=data.longUrl;
        if (Object.keys(data).length == 0) {
            return res.status(400).send({ status: false, message: "Please Enter Longurl to create shorturl" })
        }
        if (!longUrl)
            return res.status(400).send({ status: false, message: "Please provide LongUrl" });
            
        if (!validator.isURL(longUrl)) {
            return res.status(400).send({ status: false, message: "Not a valid url" })
        }
        const cachedLongUrl=await GETEX_ASYNC(`${longUrl}`)
        const Link=JSON.parse(cachedLongUrl)
        if(Link){
            return res.status(200).send({ longUrl: Link.longUrl, shortUrl: Link.shortUrl , urlCode: Link.urlCode})
        }
        let urlFound=await urlModel.findOne({longUrl:longUrl})
        if(urlFound){
            return res.status(200).send({status:true,data:{longUrl:urlFound.longUrl,shortUrl:urlFound.shortUrl,urlCode:urlFound.urlCode}})
        }
        const urlCode = shortid.generate(longUrl);
        const shortUrl = baseUrl + urlCode;

        const url = { longUrl: longUrl, urlCode: urlCode, shortUrl: shortUrl };

        const Data = await urlModel.create(url)
        await SETEX_ASYNC(`${longUrl}`,86400, JSON.stringify(Data))
        return res.status(201).send({ status: true, data: { longUrl: Data.longUrl, shortUrl: Data.shortUrl, urlCode: Data.urlCode } });
    }
    catch (err) {
        res.status(500).send({ status: false, message: err.message })
    }
};

const getUrl = async (req, res) => {
    try {
        const data = req.params
        const urlCode=data.urlCode
        if (!urlCode) {
            return res.status(400).send({ status: false, message: "Enter urlCode" })
        }
        if (!shortid.isValid(urlCode)) {
            return res.status(400).send({ status: false, message: "Urlcode is Invalid" })
        }
        const cachedUrl = await GETEX_ASYNC(`${req.params.urlCode}`)
        
        const objCache = JSON.parse(cachedUrl)
        
        if (objCache) {
            return res.status(302).redirect(objCache.longUrl)
        }
        else {
            let presenturl = await urlModel.findOne({ urlCode: urlCode })
            if (!presenturl) {
                return res.status(404).send({ status: false, message: "Urlcode is Invalid " })
            }
            await SETEX_ASYNC(`${urlCode}`,86400, JSON.stringify(presenturl))
            return res.status(302).redirect(presenturl.longUrl)
        }
    }
    
    catch (err) {
        return res.status(500).send({ status: false, message: err.message })
    }
}

module.exports = { createUrl, getUrl }




