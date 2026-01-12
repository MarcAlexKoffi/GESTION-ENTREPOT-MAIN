import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserEmpotage } from './user-empotage';

describe('UserEmpotage', () => {
  let component: UserEmpotage;
  let fixture: ComponentFixture<UserEmpotage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserEmpotage]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserEmpotage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
