#### Table of Contents
- [Why this way](#why)
- [Quick Overview](#quick-overview)
- [Pricing](#pricing)
- [GCP Overview](#gcp)
- [Templating Overview](#templating)
- [Cloudflare Overview](#cloudflare)
- [ImproveMX Overview](#improvemx)
- [Issues](#issues)
- [Conclusion](#conclusion)

#### Why

Because we can. 

Also, hosting a website can cost a lot of money. I recieved some GCP credits a few years back for a thing and have been burning through them hosting my website on a VM. Around January [Jeremy Wright](https://resume.jeremywright.codes/) suggested we try alternative methods for hosting our websites. We found a couple blog posts about using Google Cloud Storage to host websites. Many of them showed how you could use [Google Networking Services](https://cloud.google.com/products/networking) to finish the last step of hosting. The downside to this approach, however, is that it is pretty costly. Around the same time we found that [Cloudflare](https://cloudflare.com) had a free tier that covered all our needs.

#### Quick Overview

Services used:
- [Google Cloud Storage](https://cloud.google.com/storage)
- [GCP Cloud Build](https://cloud.google.com/cloud-build)
- [ImproveMX](https://improvmx.com/)
- [Cloudflare](https://cloudflare.com)

#### Pricing

Traditionally, if you were to use a server to host your site, you could expect costs such as these:

|                                      Platform                                      |     Machine Type     |  Pricing Plan  | Price Per Month |
|:-----------------------------------------------------------------------------------|:---------------------|:---------------|----------------:|
| [Azure](https://azure.microsoft.com/en-us/pricing/calculator/?service=app-service) | A0                   | Pay as you go  | $14.65          |
| [Wix](https://www.wix.com/upgrade/website)                                         | ?                    | Combo          | $13             |
| [Google](https://cloud.google.com/compute/all-pricing)                             | f1-micro<sup>1</sup> | Pay as you go  | $4.28           |
| [Amazon](https://aws.amazon.com/ec2/instance-types/t3/)                            | t3.nano<sup>2</sup>  | On Demand      | $3.796          |

<sup>1</sup> Included in the always free tier if your account is in good standing

<sup>2</sup> Included in the 12 months free program

However, for a website configured such as this one, the costs incurred with be from the storage and cloud build resources. I am using Google Cloud Platform for this site and the pricing per month can be calculated using the following:

|   Service   |  Amount per month  |        Price        | Price Per Month |
|:------------|:-------------------|:--------------------|----------------:|
| Storage     | .15 GB             | $0.026 / GB         | $0.0039         |
| Class A Ops | ~500<sup>1</sup>   | $0.005 / 1000 ops   | $0.0025         |
| Class B Ops | ~5000<sup>2</sup>  | $0.0004 / 1000 ops  | $0.002‬          |

<sup>1</sup> This number reflects the amount of times you make changes to your site

<sup>2</sup> This number reflects how much traffic your site is getting

|   Service   |    Build-minutes    |               Price               | Price Per Month |
|:------------|:--------------------|:----------------------------------|----------------:|
| Cloud Build | 2 / day<sup>1</sup> | $0.003 / build-minute<sup>2</sup> | $0              |

<sup>1</sup> Build times average about 1-2 minutes per build. Builds for this site are only run when a commit is pushed to the master branch

<sup>2</sup> The first 120 builds-minutes per day are [free](https://cloud.google.com/cloud-build/pricing)

If we add this all up we get about $0.01 USD per month. However for some reason I've been consistently getting $0.02 USD per month. The cost per month of your website will basically come down to how many times per month you update the files in storage and how much traffic your site gets. In regards to the Class A operations, you should really never exceed $0.01 USD unless you're updating a lot of content multiple times a day. For the Class B operations, the more your content is accessed, the more you'll pay. Luckily for us, Cloudflare caches files for free on their global CDN which saves money.

#### GCP

1. [Register](https://search.google.com/search-console/welcome) your domain with gcp
2. Buckets! I prefer to have a seperate bucket for each sudomain on my site in addition to the static files. You'll need to name your buckets in occordence with your domain name in order for this to work (ex. static.scub3d.io or scub3d.io).
3. Next edit the bucket(s) website configuration so that the index page points to index and error points to error. Don't do this step for the static bucket if you have one. We omit the .html but that gets covered below.
4. Now edit the bucket permissions so that allUsers have read access.
5. Go to Cloud Build and link the GitHub repository you want.
6. Add a trigger for push to master
7. Make sure everything looks good in the [cloudbuild](../master/cloudbuild.yaml) file.

When the cloudbuild file runs, it will obtain a copy of the repositories contents. We need to get those into the correct buckets, after applying the template to everything.

```YAML
.
.
.
# apply the template to the html files
- name: ubuntu
  args: ['bash', './apply_template.sh', './views/www/']

# rsync website html files into the bucket
- name: gcr.io/cloud-builders/gsutil
  args: ["-m", "rsync", "-c", "-d", "./views/www", "gs://scub3d.io"]

# copy the files to files that don't have .html extensions and ensure they're treated as html files by the bucket. Then rm the old files
# I don't believe setting the headers this way works with mv
- name: "gcr.io/cloud-builders/gsutil"
  args: ["-h", "Content-Type:text/html", "cp", "gs://scub3d.io/error.html", "gs://scub3d.io/error"] 
- name: "gcr.io/cloud-builders/gsutil"
  args: ["rm", "gs://scub3d.io/error.html"] 
.
.
.
```

#### Templating

Originally I was using the [Cyclone](http://cyclone.io) framework to serve my site. I was also using cyclone's built in [templating system](http://cyclone.io/documentation/template.html). When I was working on getting this set up, I wanted a similarly functioning templating system. In order to achieve this I created a [shell script](../master/apply_template.sh) that will auto template any html file in the directory provided to the script. I did have some issues getting my script to work in the cloud build file, however, that is because, I am dumb. One minor thing to note is that in order for apply-template.sh to work in the cloud build properly you have to give the script executable permissions. I recommend developing on a unix machine to make this easier.

I chose the following style for the template because it is basically how my templates were previously setup.

```html
{% block css %}
    <div> My HTML stuff here</div>
{% end %}

.
.
.

{% block js %}
    <div> My HTML stuff here too</div>
{% end %}
```

I'm lazy and didn't feel like changing it right now. You can if you want to though. Just make sure the sed command in apply-template.sh reflects those changes.

#### Cloudflare

Cloudflare is essential to making this work. After creating an account, link your domain to cloudflare to give them control over the DNS records. You'll have to update your domain registrar with the proper Cloudflare nameservers. Once that's done:
- Enable Flexible SSL encryption
- Create a bunch of CNAME records that point to c.storage.googleapis.com 
- Implement any pages rules you may want

#### ImproveMX

Now that everything else is setup, the last thing needed is the ability to forward emails from the domain to a personal email address. Since we are now using cloudflare's nameservers, we can no longer rely on email forwarding protocols from our domain registrar. Instead we can setup forwarding rules using [improvemx](https://improvemx.com) for free. 

#### Issues

For the templates, the way the replacement works, it doesn't like if any of the blocks are empty, so I just include a comment for now.

I have found that certain files will refuse to load via https from a different domain. The biggest issue is font files. For some reason the only type of font file I can get to load via https without issue are .woff2 files. I was forced to convert some of my .otf and .ttf font files to .woff2 in order to get them to properly load. 

The biggest potential downside to this approach is that since you get charged based on traffic to your website, this does not really scale up well. In addition to this, there is the potential for abuse. If someone wanted to they could increase costs by DoS/DDoSing the site. This would cause a large spike in Class B operations which would increase the bill. However, a way to mitigate this is to setup Google Billing budget alerts at around $1-2 USD and to enable Cloudflare's DDoS protection system<sup>1</sup>. 

<sup>1</sup>I tested this out on my site for fun and it seemed to cause even more CORS issues with the font files again.

A few other minor issues are 
- Under the Cloudflare free plan you are limited to three page rules per domain.
- Since we are storing our content in a bucket, we can't use Full or Full (strict) SSL encryption.
- Sometimes Cloudflare caches can act up. When updating your site, be sure to enable 'Development Mode' to bypass the cache.

#### Conclusion

Here are some of the pro/cons I could come up with:

##### Pros
    - Hella cheap
    - Lowish matience
    - Different
    - $0.02 per month
##### Cons
    - More complicated setup
    - Cloudflare free tier restrictions
    - Some loss of functionality (compared with a server)
    - Requires web dev knowledge
    - CORS issues
    - Potential for abuse

I'm glad I did this, it was fun getting it to work.

P.S.

I haven't really set anything up to handle local testing besides just assuming it will work then being shocked when it doesn't after I commit and push. There are a couple ways around having a messy commit history.

1. Set up a dev subdomain for testing changes and implement a cloud build to detect updates an a non-master branch. Then when you are satisfied with the results you can squash the commits and merge to the master branch

2. Implement something similar to what I've put below to do local testing. The only issue with it is that it doesn't work if any of your static files also reference static files. Not too hard to implement tho. I'll get around to it

```bash
#!/bin/sh

declare -a subdomains=("www" "minesweeper")

cp -r views/ LOCAL_TESTING/
for subdomain in ${subdomains[@]}; do
    bash apply_template.sh LOCAL_TESTING/$subdomain/

    for filename in LOCAL_TESTING/$subdomain/*.html; do
        sed -i "s~//static.scub3d.io/~../../static/~g" "$filename"
    done    
done

# cp -r all static files into LOCAL_TESTING dir too
# Iterate over static files here 
```