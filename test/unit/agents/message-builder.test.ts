import { MessageBuilder } from '../../../src/agents/message-builder';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Mock fs and os modules
jest.mock('fs');
jest.mock('os');

describe('MessageBuilder', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockOs = os as jest.Mocked<typeof os>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOs.tmpdir.mockReturnValue('/tmp');
    mockFs.existsSync.mockReturnValue(true);
  });

  describe('generateMcpConfig', () => {
    it('should return null when no servers are provided', () => {
      const result = MessageBuilder.generateMcpConfig([], 'test-project');

      expect(result).toBeNull();
      expect(mockFs.writeFileSync).not.toHaveBeenCalled();
    });

    it('should use all servers passed to it without filtering by enabled property', () => {
      const servers = [
        {
          id: 'server1',
          name: 'Server 1',
          enabled: false, // This should still be included
          type: 'stdio' as const,
          command: 'command1',
        },
        {
          id: 'server2',
          name: 'Server 2',
          enabled: true,
          type: 'stdio' as const,
          command: 'command2',
        },
      ];

      const result = MessageBuilder.generateMcpConfig(servers, 'test-project');

      expect(result).not.toBeNull();
      expect(mockFs.writeFileSync).toHaveBeenCalledTimes(1);

      // Check the written config includes both servers
      const writtenContent = mockFs.writeFileSync.mock.calls[0]?.[1] as string;
      const config = JSON.parse(writtenContent);

      expect(config.mcpServers).toHaveProperty('Server 1');
      expect(config.mcpServers).toHaveProperty('Server 2');
      expect(config.mcpServers['Server 1'].command).toBe('command1');
      expect(config.mcpServers['Server 2'].command).toBe('command2');
    });

    it('should create temp directory if it does not exist', () => {
      mockFs.existsSync.mockReturnValue(false);

      const servers = [{
        id: 'server1',
        name: 'Server 1',
        enabled: true,
        type: 'stdio' as const,
        command: 'command1',
      }];

      MessageBuilder.generateMcpConfig(servers, 'test-project');

      expect(mockFs.mkdirSync).toHaveBeenCalledWith(
        path.join('/tmp', 'claudito-mcp'),
        { recursive: true }
      );
    });

    it('should generate unique config file names', () => {
      const servers = [{
        id: 'server1',
        name: 'Server 1',
        enabled: true,
        type: 'stdio' as const,
        command: 'command1',
      }];

      const result1 = MessageBuilder.generateMcpConfig(servers, 'project1');
      const result2 = MessageBuilder.generateMcpConfig(servers, 'project2');

      expect(result1).toContain('mcp-project1-');
      expect(result2).toContain('mcp-project2-');
      expect(result1).not.toEqual(result2);
    });

    it('should handle stdio servers with args and env', () => {
      const servers = [{
        id: 'server1',
        name: 'Server 1',
        enabled: true,
        type: 'stdio' as const,
        command: 'command1',
        args: ['--arg1', 'value1'],
        env: { NODE_ENV: 'production' },
      }];

      MessageBuilder.generateMcpConfig(servers, 'test-project');

      const writtenContent = mockFs.writeFileSync.mock.calls[0]?.[1] as string;
      const config = JSON.parse(writtenContent);

      expect(config.mcpServers['Server 1']).toEqual({
        command: 'command1',
        args: ['--arg1', 'value1'],
        env: { NODE_ENV: 'production' },
      });
    });

    it('should handle http servers with headers', () => {
      const servers = [{
        id: 'server1',
        name: 'API Server',
        enabled: true,
        type: 'http' as const,
        url: 'http://localhost:8080',
        headers: { 'Authorization': 'Bearer token' },
      }];

      MessageBuilder.generateMcpConfig(servers, 'test-project');

      const writtenContent = mockFs.writeFileSync.mock.calls[0]?.[1] as string;
      const config = JSON.parse(writtenContent);

      expect(config.mcpServers['API Server']).toEqual({
        transport: {
          type: 'http',
          url: 'http://localhost:8080',
          headers: { 'Authorization': 'Bearer token' },
        },
      });
    });

    it('should handle multiple servers of different types', () => {
      const servers = [
        {
          id: 'server1',
          name: 'Stdio Server',
          enabled: true,
          type: 'stdio' as const,
          command: 'command1',
        },
        {
          id: 'server2',
          name: 'HTTP Server',
          enabled: false, // Should still be included
          type: 'http' as const,
          url: 'http://api.example.com',
        },
      ];

      MessageBuilder.generateMcpConfig(servers, 'test-project');

      const writtenContent = mockFs.writeFileSync.mock.calls[0]?.[1] as string;
      const config = JSON.parse(writtenContent);

      expect(Object.keys(config.mcpServers)).toHaveLength(2);
      expect(config.mcpServers['Stdio Server']).toHaveProperty('command');
      expect(config.mcpServers['HTTP Server']).toHaveProperty('transport');
    });

    it('should include servers with enabled: false', () => {
      const servers = [{
        id: 'disabled-server',
        name: 'Disabled Server',
        enabled: false,
        type: 'stdio' as const,
        command: 'disabled-command',
      }];

      const result = MessageBuilder.generateMcpConfig(servers, 'test-project');

      expect(result).not.toBeNull();
      expect(mockFs.writeFileSync).toHaveBeenCalled();

      const writtenContent = mockFs.writeFileSync.mock.calls[0]?.[1] as string;
      const config = JSON.parse(writtenContent);

      expect(config.mcpServers).toHaveProperty('Disabled Server');
      expect(config.mcpServers['Disabled Server'].command).toBe('disabled-command');
    });
  });

  describe('buildUserMessage', () => {
    it('should return plain text when no images provided', () => {
      const result = MessageBuilder.buildUserMessage('Hello world');
      expect(result).toBe('Hello world');
    });

    it('should format message with images', () => {
      const images = [
        { data: 'base64data1', mediaType: 'image/png' },
        { data: 'base64data2', mediaType: 'image/jpeg' },
      ];

      const result = MessageBuilder.buildUserMessage('Describe these images', images);

      expect(result).toContain('<image media_type="image/png">base64data1</image>');
      expect(result).toContain('<image media_type="image/jpeg">base64data2</image>');
      expect(result).toContain('Describe these images');
    });
  });

  describe('buildArgs', () => {
    it('should include --mcp-config when mcpConfigPath is provided', () => {
      const args = MessageBuilder.buildArgs({
        mode: 'interactive',
        mcpConfigPath: '/tmp/mcp-config.json',
      });

      expect(args).toContain('--mcp-config');
      expect(args).toContain('/tmp/mcp-config.json');
    });

    it('should not include --mcp-config when mcpConfigPath is not provided', () => {
      const args = MessageBuilder.buildArgs({
        mode: 'interactive',
      });

      expect(args).not.toContain('--mcp-config');
    });
  });
});