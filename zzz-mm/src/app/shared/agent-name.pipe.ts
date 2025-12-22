import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'agentName',
  standalone: true,
})
export class AgentNamePipe implements PipeTransform {
  transform(value: string): string {
    switch (value) {
      case 'soldier-11':
        return 'Soldier 11';
      case 'npcs':
        return 'NPCs';
      case 'unknown':
        return 'Unknown';
      case 'ye-shunguang':
        return 'Xiaoguang';
      case 'zhu-yuan':
        return 'Zhu-Yuan';
      case 'pan-yinhu':
        return 'Pan-Yinhu';
      default:
        const firstName = value.split('-')[0].trim();
        return firstName.charAt(0).toUpperCase() + firstName.slice(1);
    }
  }
}
