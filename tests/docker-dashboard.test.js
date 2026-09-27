const test = require('node:test');
const assert = require('node:assert');
const { DockerClient } = require('../src/dev/docker-dashboard/docker-client');

test('DockerClient mock listContainers', async () => {
  const client = new DockerClient({ mockFallback: true });
  const containers = await client.listContainers();
  assert.strictEqual(containers.length, 1);
  assert.strictEqual(containers[0].Id, 'mock-123');
});

test('DockerClient mock getPortMappings', async () => {
  const client = new DockerClient({ mockFallback: true });
  const mappings = await client.getPortMappings();
  assert.strictEqual(mappings.length, 1);
  assert.strictEqual(mappings[0].port, 8080);
  assert.strictEqual(mappings[0].title, 'mock-container');
});
