import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminEmpotageMain } from './admin-empotage-main';

describe('AdminEmpotageMain', () => {
  let component: AdminEmpotageMain;
  let fixture: ComponentFixture<AdminEmpotageMain>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminEmpotageMain]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminEmpotageMain);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
