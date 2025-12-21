import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { NavbarComponent } from '../navbar/navbar.component';
import { ModListComponent } from '../mod-list/mod-list.component';

@Component({
  selector: 'app-wrapper-comp',
  templateUrl: './mod-manager-wrapper.component.html',
  styleUrl: './mod-manager-wrapper.component.scss',
  standalone: true,
  imports: [CommonModule, NavbarComponent, ModListComponent],
})
export class ModManagerWrapperComponent {}
