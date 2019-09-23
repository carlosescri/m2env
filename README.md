# m2env

CLI app to build Magento 2 Docker environments easily.

## Requirements

- Docker
- A NodeJS supporting promises, async/await, promisify… I'm using v10.

## Installation

1. Clone the repo and enter the directory
2. Run `npm install -g .`

To uninstall run `npm uninstall -g .` from the project's directory.

## Usage

```bash
~$ mkdir my_project && cd my_project
my_project$ m2env init [--packages /path/to/m2/plugins/dir]
my_project$ m2env build
my_project$ docker-compose up
# wait… and in other shell when finishes…
my_project$ m2env install-magento
# if you want to isntall a plugin…
my_project$ m2env install-plugin doofinder/doofinder-magento2
```

## Credits

95% of Docker stuff was provided by @magently (<https://www.magently.com/>).
