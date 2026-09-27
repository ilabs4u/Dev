const { DockerClient } = require('./docker-client');

class DockerDashboardUI {
  constructor() {
    this.client = new DockerClient();
    this.render();
  }
  async render() {
    const containers = await this.client.listContainers();
    const grid = document.getElementById('docker-grid');
    if(grid) {
      grid.innerHTML = containers.map(c => `<div class="container-card">${c.Id} - ${c.State}</div>`).join('');
    }
  }
}
module.exports = { DockerDashboardUI };
