const anticaptcha = require('./anticaptcha')("4004b8b6efa2e6b87830978dc08ce924"),
	needle = require('needle'),
	fs = require('fs'),
	cheerio = require('cheerio');

const stream = fs.createWriteStream('./result.html');

const keywordsFile = fs.readFileSync('./keywords.txt')
	.toString()
	.split('\n')
	.map(e => e.trim());

const regionsFile = fs.readFileSync('./regions.csv')
	.toString()
	.split('\n')
	.map(e => e.trim())
	.map(e => e.split(',').map(e => e.trim()));

//recaptcha key from target website
// anticaptcha.setWebsiteURL("http://mywebsite.com/recaptcha/test.php");
// anticaptcha.setWebsiteKey("sitekey-can-be-taken-from-div.g-recaptcha-element");

//proxy access parameters
// anticaptcha.setProxyType("http");
// anticaptcha.setProxyAddress("proxyaddress");
// anticaptcha.setProxyPort(8080);
// anticaptcha.setProxyLogin("proxylogin");
// anticaptcha.setProxyPassword("proxypassword");

//browser header parameters
anticaptcha.setUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116");

anticaptcha.setCookies("anticaptcha=cool; cookies=set");

for (keywordEl in keywordsFile) {
	if (keywordsFile[keywordEl] == '') continue;
	for (regionEl in regionsFile) {
		if (regionsFile[regionEl] == '') continue;
		console.log(`get "${regionsFile[regionEl][1]}" by "${keywordsFile[keywordEl]}"`);
		getAds(keywordsFile[keywordEl], regionsFile[regionEl][1], regionsFile[regionEl][0]);
	}
}

function toDataURL(url, callback) {
	const xhr = new XMLHttpRequest();
	
	xhr.onload = function () {
		const reader = new FileReader();
		
		reader.onloadend = function () {
			callback(reader.result);
		}

		reader.readAsDataURL(xhr.response);
	};

	xhr.open('GET', url);
	xhr.responseType = 'blob';
	xhr.send();
}

function getAds(keyword, region, regionCode, page = 0) {
	needle.get(
		`https://yandex.ru/search/ads?text=${encodeURI(keyword)}&lr=${regionCode}&p=${page}`,
		function (err, res) {
			if (!err && res.statusCode == 200) {
				const $ = cheerio.load(res.body);

				if ($('.form__captcha').length > 0) {
					console.log($('.form__captcha').html());

					// check balance first
					anticaptcha.getBalance(function (err, balance) {
						if (err) {
							console.error(err);
							return;
						}

						if (balance > 0) {
							toDataURL($('.form__captcha').attr('src'), function(base64str) {
								const task = {
									type: "ImageToTextTask",
									body: base64str,
									minLength: 0,
									maxLength: 0
								};

								anticaptcha.createTask(function (err, taskId) {
									if (err) {
										console.error(err);
										return;
									}
	
									console.log(taskId);
	
									anticaptcha.getTaskSolution(taskId, function (err, taskSolution) {
										if (err) {
											console.error(err);
											return;
										}
	
										console.log(taskSolution);
									});
								}, "ImageToTextTask", task);
							});
						}
					});
				}

				$('li.serp-item').each(function (i, el) {
					if ($(this).find('.organic__path').length < 1) {
						let linkHref = $(this).find('.organic__url').attr('href');
						let linkTitle = $(this).find('.organic__url-text').text();
						stream.write(`(${region}) ${linkTitle} &mdash; <a target="_blank" href="${linkHref}">Перейти</a><br>`);
					}
				});

				if ($('.pager__item.pager__item_kind_next').length > 0) {
					getAds(keyword, region, page + 1);
				}
			}
		}
	);
}
