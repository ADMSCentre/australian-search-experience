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


<!-- GETTING STARTED -->
## Description

The infrastructure of this project is compiled as a cross-browser search plugin that operates on Google Chrome, Microsoft Edge, Mozilla Firefox, and Blink Opera. The plugin uses a boilerplate template by Bharani (see https://github.com/EmailThis/extension-boilerplate). It runs exactly as was originally conceived by AlgorithmWatch (https://github.com/algorithmwatch/australianSearchExperience), with the addition of some extended functionality. The plugin is designed such that it periodically scrapes data from a simulated search engine session and then sends the data up to our server.

If you would like to compile the unpacked extension, you will need a current installation of `npm`. Navigate to the cloned folder and then run the command `npm install`. This will install the necessary modules for the extension. Then run the command `npm run buildmv2` (for Mozilla Firefox and Blink Opera) or `npm run buildmv3` (for Google Chrome or Microsoft Edge), depending on which browser you will be using.

### Backend

Included with this code is the `backend` folder, which includes all extended functionality of the plugin that resides on external infrastructure. For the project, we use Amazon Web Services and Google Cloud products, specifically S3, DynamoDB, Lambda, EventBridge, and BigQuery.

In the `backend\lambdas` folder is the annotated source code for all AWS Lambda functions, which handle functionality that relates to accepting submitted data donations (see `backend\lambdas\aw-datenspende-api`), paginating said data donations (see `backend\lambdas\aw-datenspende-pull`), sanitising the data and pushing it to Google BigQuery for more advanced analysis (see `backend\lambdas\aw-datenspende-bq-api`), and viewing quick statistics about the data (see `backend\lambdas\aw-datenspende-quickstats`).

_Note: While the necessary configuration details to reinstantiate the AWS Lambda functions are provided here in YAML format, the configuration details for the relevant DynamoDB/BigQuery tables, S3 buckets, and EventBridge rules aren't, given that very little data constitutes their configuration. In later commits, this data will be added in the form of associated notes to assist with reinstantiating the entire server infrastructure if necessary._

The backend folder also includes the front-end website code that individuals submit to register their access to the plugin (see `backend\acquisition-form`), as well as the assistant script required to submit 'real-time' changes to the keywords that are queried by the plugin's search routines, as well as the ephemeral scraping mechanisms used to obtain data relative to each platform.

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