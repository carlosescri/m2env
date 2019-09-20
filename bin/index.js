#!/usr/bin/env node

const findUp = require('find-up');
const fs = require('fs');
const inquirer = require('inquirer');
const yargs = require('yargs');

const {clean, phpversion} = require('../lib/versions');
const nginx = require('../lib/nginx');
const project = require('../lib/project');

const noop = () => {};
const configPath = findUp.sync(['.m2envrc', '.m2env.json'])
const config = configPath ? JSON.parse(fs.readFileSync(configPath)) : {};

yargs
  .scriptName('m2env')
  .config(config)
  .locale('en')
  .command(['init', '$0'], 'Prepare current working directory to hold a Magento 2 environment.', noop, async () => {
    const answers = await inquirer.prompt([
      {
        name: 'magento',
        type: 'input',
        message: 'Magento version (x.y[.z])',
        filter: async (input) => clean(input),
        validate: async (input) => !!input,
      },
      {
        name: 'php',
        type: 'input',
        message: 'PHP version (x[.y])',
        filter: async (input) => clean(input, 2),
        validate: async (input) => !!input,
        default: async (answers) => phpversion(answers.magento)
      },
      {
        name: 'user',
        type: 'input',
        message: 'Username',
        prefix: '[Magento Repository]'
      },
      {
        name: 'pass',
        type: 'password',
        message: 'Password',
        prefix: '[Magento Repository]'
      }
    ]);
    fs.writeFileSync(`./.m2envrc`, JSON.stringify(answers, null, 2));
  })
  .command('build', 'Create a new Magento 2 Docker image.', noop, async (config) => {
    try {
      await nginx.build(config);
      await project.build(config);
      console.log('You can execute docker-compose up to start the environment!');
    } catch (error) {
      console.log(error.message);
      return false;
    }

    return true;
  })
  .command('install', 'Install Magento 2 in a running project', noop, async (config) => {
    return await project.install(config);
  })
  .argv;
