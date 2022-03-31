<!-- PROJECT LOGO -->
<br />
<p align="center">
  <a href="https://github.com/ADMSCentre/australian-search-experience">
    <img src="https://www.admscentre.org.au/wp-content/uploads/2021/06/brand_logo_2.png" alt="Logo" width="80" height="80">
  </a>

  <h3 align="center">The Australian Search Experience - 2021</h3>

  <p align="center">
    This is the data donation project currently being led by Abdul Karim Obeid (@askoj), and supervised by Professor Axel Bruns, and Associate Professor Daniel Angus of the ADM+S, in collaboration with AlgorithmWatch.
    <br />
    <a href="https://github.com/ADMSCentre/australian-search-experience/issues">Report Bug</a>
    ·
    <a href="https://github.com/ADMSCentre/australian-search-experience/issues">Request Feature</a>
  </p>
</p>

#### Phase 1 - Installation Of Plugin

Users install the _Node.js_ based plugin from their respective web extension store. This source code is found at the top-level of this repository.

The infrastructure of this project is compiled as a cross-browser search plugin that operates on Google Chrome, Microsoft Edge, Mozilla Firefox, and Blink Opera. The plugin uses a boilerplate template by Bharani (see https://github.com/EmailThis/extension-boilerplate). It runs exactly as was originally conceived by AlgorithmWatch (https://github.com/algorithmwatch/australianSearchExperience), with the addition of some extended functionality. The plugin is designed such that it periodically scrapes data from a simulated search engine session and then sends the data up to our server.

If you would like to compile the unpacked extension, you will need a current installation of `npm`. Navigate to the cloned folder and then run the command `npm install`. This will install the necessary modules for the extension. Then run the command `npm run buildmv2` (for Mozilla Firefox and Blink Opera) or `npm run buildmv3` (for Google Chrome or Microsoft Edge), depending on which browser you will be using.

#### Phase 2 - Plugin Is Registered

Once installed, the user is redirected to a registration page implemented in _HTML / CSS / JavaScript_ (`backend\acquisition-form`). When the user submits the form, it calls an API endpoint for the `aw-datenspende-api` _AWS Lambda_ function (`backend\lambdas\aw-datenspende-api`) to generate user's de-identified demographic profile (`aw-datenspende-users` _AWS DynamoDB_ table) for use with the plugin. This process is vetted by the entries of the `aw-datenspende-ip-cache` _AWS DynamoDB_ table, which throttle excessive registrations.

#### Phase 3 - Plugin Data Donation

When the plugin periodically runs, data is sent from the user's local machine to the API endpoint of the `aw-datenspende-api` _AWS Lambda_ function (`backend\lambdas\aw-datenspende-api`), which records the metadata of the data donation in the `aw-datenspende` _AWS DynamoDB_ table, and the data of the data donation itself within the `aw-datenspende-bucket` _AWS S3_ bucket. This process is vetted by the entries of the `aw-datenspende-ip-cache` _AWS DynamoDB_ table, which throttle excessive data donations.

#### Phase 4 - Data Donations to BigQuery

On an hourly basis, the `AWDatenspendeBQHourlyGoogleNews`, `AWDatenspendeBQHourlyGoogleSearch`, `AWDatenspendeBQHourlyGoogleVideos`, `AWDatenspendeBQHourlyUserAppend`, and `AWDatenspendeBQHourlyYoutube` _AWS EventBridge_ rules are automatically executed. Each rule instantiates an instance of the `aw-datenspende-bq-api` _AWS Lambda_ function (`backend\lambdas\aw-datenspende-bq-api`), by means of the following JSONs, where any respective line is given as the configured target input:

```json
  { "platform" : "google_news" } /* AWDatenspendeBQHourlyGoogleNews */
  { "platform" : "google_search" } /* AWDatenspendeBQHourlyGoogleSearch */
  { "platform" : "google_videos" } /* AWDatenspendeBQHourlyGoogleVideos */
  { "platform" : "users" } /* AWDatenspendeBQHourlyUserAppend */
  { "platform" : "youtube" } /* AWDatenspendeBQHourlyYoutube */
```

Each respective instance of the _AWS Lambda_ functions queries an entry within the `aw-datenspende-bq-ticker` _AWS DynamoDB_ table for the current index (as a time window) of data donations to push. To index said time windows, the `aw-datenspende-bq-api` _AWS Lambda_ function calls the `aw-datenspende-pull` _AWS Lambda_ function (`backend\lambdas\aw-datenspende-pull`), which returns the necessary data back to it. The data is then sanitised and mapped to the necessary schema, before being stored in the `aw-datenspende-bq-bucket` _AWS S3_ bucket. Lastly, it is pushed to the Google BigQuery infrastructure, for which the creation scripts of all necessary tables and their associated schemas can be found at `backend\lambdas\aw-datenspende-bq-api\run.py` and `backend\lambdas\aw-datenspende-bq-api\schemas\*` respectively.

#### Quick Statistics

On a daily basis, statistics about the number of current user registrations and data donations are compiled. This is achieved by the `AWDatenspendeRunDaily` _AWS EventBridge_ rule, which calls the `aw-datenspende-quickstats` _AWS Lambda_ function (`backend\lambdas\aw-datenspende-quickstats`), by means of an empty JSON input. The resulting statistics are stored in the file entitled `user_stats.json`, within the `aw-datenspende-bucket` _AWS S3_ bucket for public access.

#### Note on DynamoDB infrastructure

Within the entire Australian Search Experience infrastructure, there is no specification for the setup of the DynamoDB tables. This is because DynamoDB tables are always schemaless; all tables included in this project share the same configuration of a `uuid` primary key. Beyond this, all configuration is inherited by the source code of the supporting infrastructures.

<!-- CONTACT -->
### Contact

Abdul Obeid - [@aobeid_1](https://twitter.com/aobeid_1) - obei@qut.edu.au

Project Link: [https://github.com/ADMSCentre/australian-search-experience](https://github.com/ADMSCentre/australian-search-experience)


<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[contributors-shield]: https://img.shields.io/github/contributors/github_username/repo.svg?style=for-the-badge
[contributors-url]: https://github.com/github_username/repo/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/github_username/repo.svg?style=for-the-badge
[forks-url]: https://github.com/github_username/repo/network/members
[stars-shield]: https://img.shields.io/github/stars/github_username/repo.svg?style=for-the-badge
[stars-url]: https://github.com/github_username/repo/stargazers
[issues-shield]: https://img.shields.io/github/issues/github_username/repo.svg?style=for-the-badge
[issues-url]: https://github.com/github_username/repo/issues
[license-shield]: https://img.shields.io/github/license/github_username/repo.svg?style=for-the-badge
[license-url]: https://github.com/github_username/repo/blob/master/LICENSE.txt
[linkedin-shield]: https://img.shields.io/badge/-LinkedIn-black.svg?style=for-the-badge&logo=linkedin&colorB=555
[linkedin-url]: https://linkedin.com/in/github_username