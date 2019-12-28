const dotenv = require('dotenv').config()
const express = require('express')
const app = express()
const crypto = require('crypto')
const cookie = require('cookie')
const nonce = require('nonce')
const querystring = require('querystring')
const request = require('request-promise')
const logger = require('morgan')

const apiKey = process.env.SHOPIFY_API_KEY
const apiSecret = process.env.SHOPIFY_API_SECRET
const scopes = 'read_products'
const fowardingAddress = 'http://c95b28d7.ngrok.io'

app.use(logger('dev'))

app.get('/', (req, res) => {
    res.send('Text app')
})

app.get('/shopify', (req, res) => {
    const shop = req.query.shop
    if(shop){
        const state = nonce()
        const redirectUri = fowardingAddress + '/shopify/callback'
        const installUrl = 'https://' + shop +
            '/admin/oauth/authorize?client_id=' + apiKey +
            '&scope=' + scopes +
            '&state=' + state +
            '&redirect_uri=' + redirectUri
        console.log('initial state from nonce is ' + state)
        res.cookie('state', state)
        res.redirect(installUrl)
    } else {
        return res.status(400).send('Missing shop parameter')
    }
})

app.get('/shopify/callback', (req, res) => {
    const { shop, hmac, code, state } = req.query
    // state coming from query not matching state in cookie??
    const stateCookie = cookie.parse(req.headers.cookie).state
// issues with state params
    console.log('state is ' + state)
    console.log('stateCookie is ' + stateCookie)
    if (state !== stateCookie){
        console.log(req.query)
        return res.status(403).send('Request origin cannot be verified')
    }

    if (shop && hmac && code){
        // res.status(200).send('Callback route')
        // first attempt at following TODO
        const map = Object.assign({}, req.query)
        delete map['signature']
        delete map['hmac']
        const message = querystring.stringify(map)
        const providedHmac = Buffer.from(hmac, 'utf-8')
        const generatedHash = Buffer.from(
            crypto
                .createHmac('sha256', apiSecret)
                .update(message)
                .digest('hex'),
                'utf-8'
        )
        let hashEquals = false
        try {
            hashEquals = crypto.timingSafeEqual(generatedHash, providedHmac)
        } catch (e) {
            hashEquals = false
        }
        if (!hashEquals){
            return res.status(400).send('HCAC validation failed')
        }
        res.status(200).send('HMAC validated')
        // TODO
        // Validate request is from Shopify
        // Exchange temporary code for a permanent access token
        // Use access token to make API call to 'shop' endpoint
    } else {
        res.status(400).send('Required parameters missing')
    }
})

app.listen(3000, () => {
    console.log('Listening on port 3000')
})