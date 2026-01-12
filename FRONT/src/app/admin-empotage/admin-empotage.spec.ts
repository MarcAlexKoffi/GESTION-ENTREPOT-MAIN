import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminEmpotage } from './admin-empotage';

describe('AdminEmpotage', () => {
  let component: AdminEmpotage;
  let fixture: ComponentFixture<AdminEmpotage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEmpotage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminEmpotage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
