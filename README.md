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
my_project$ USER=… PASS=… m2env 2.3.2
my_project$ docker-compose up
```

**Notice:** `USER` and `PASS` are your username and password for the Magento 2 repo.

Access the `app` container to continue installing Magento 2:

```bash
my_project$ docker-compose exec app gosu application bash
```

To be continued…

## Credits

99% of Docker stuff was provided by @magently (<https://www.magently.com/>).
