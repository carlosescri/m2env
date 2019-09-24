#!/usr/bin/env node

const findUp = require('find-up');
const fs = require('fs');
const inquirer = require('inquirer');
const path = require('path');
const util = require('util');
const yargs = require('yargs');

const {clean, phpversion} = require('../lib/versions');
const nginx = require('../lib/nginx');
const project = require('../lib/project');

const noop = () => {};
const fstat = util.promisify(fs.stat);

const configPath = findUp.sync(['.m2envrc', '.m2env.json'])
const config = configPath ? JSON.parse(fs.readFileSync(configPath)) : {};

function checkConfig(config) {
  if (!config.magento) {
    throw new Error('Please, execute m2env init first!!!');
  }
}

yargs
  .scriptName('m2env')
  .config(config)
  .locale('en')
  .command('init', 'Prepare current working directory to hold a Magento 2 environment.', noop, async (config) => {
    const overwrite = !!config.magento;

    let questions = [
      {
        name: 'magento',
        type: 'input',
        message: 'Magento version (x.y[.z])',
        filter: async (input) => clean(input),
        validate: async (input) => !!input,
        default: config.magento || undefined
      },
      {
        name: 'php',
        type: 'input',
        message: 'PHP version (x[.y])',
        filter: async (input) => clean(input, 2),
        validate: async (input) => !!input,
        default: async (answers) => config.php || phpversion(answers.magento)
      },
      {
        name: 'servername',
        type: 'input',
        message: 'Server Name',
        default: async () => config.servername || 'magento.dev'
      },
      {
        name: 'language',
        type: 'input',
        message: 'Language',
        default: async () => config.language || 'en_US'
      },
      {
        name: 'currency',
        type: 'input',
        message: 'Currency',
        default: async () => config.currency || 'USD'
      },
      {
        name: 'timezone',
        type: 'input',
        message: 'Timezone',
        default: async () => config.timezone || 'America/Chicago'
      },
      {
        name: 'username',
        type: 'input',
        message: 'Username',
        prefix: '[Magento Repository]',
        default: config.username || undefined
      },
      {
        name: 'password',
        type: 'password',
        message: 'Password',
        prefix: '[Magento Repository]',
        default: config.password || undefined
      },
      {
        name: 'packages',
        type: 'input',
        message: 'Packages Directory',
        prefix: '[Packages]',
        default: null
      },
      {
        name: 'composer',
        type: 'input',
        message: 'Composer Config Directory',
        prefix: '[Packages]',
        default: null
      }
    ];

    if (overwrite) {
      questions.push({
        name: 'save',
        type: 'confirm',
        message: 'Overwrite existing settings file?',
        default: false
      });
    }

    const answers = await inquirer.prompt(questions);

    if (answers.save || !overwrite) {
      delete answers.save;

      if (answers.packages) {
        let ok = false;
        try {
          const packagesdir = path.resolve(answers.packages);
          const dirinfo = await fstat(answers.packages);
          ok = dirinfo.isDirectory();
        } catch(error) {
        } finally {
          if (!ok) {
            answers.packages = null;
            console.warn('packages directory is not valid and will not be saved!');
          }
        }
      }

      fs.writeFileSync(`./.m2envrc`, JSON.stringify(answers, null, 2));
      console.log('saved!');
    } else {
      console.log('not saved!');
    }
  })
  .command('build', 'Create a new Magento 2 environment.', noop, async (config) => {
    try {
      checkConfig(config);
      await nginx.build(config);
      return await project.build(config);
    } catch (error) {
      console.log('error', error, error.message);
      return 1;
    }
  })
  .command('install-magento', 'Install Magento 2 in a running project', noop, async (config) => {
    try {
      checkConfig(config);
      return await project.run('install.sh', config);
    } catch (error) {
      console.log('error', error, error.message);
      return 1;
    }
  })
  .command('install-plugin <plugin>', 'Install Magento 2 in a running project', noop, async (config) => {
    try {
      checkConfig(config);
      return await project.run(`install_plugin.sh ${config.plugin}`, config);
    } catch (error) {
      console.log('error', error, error.message);
      return 1;
    }
  })
  .demandCommand()
  .help()
  .argv;
