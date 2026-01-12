import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserDashboardMain } from './user-dashboard-main';

describe('UserDashboardMain', () => {
  let component: UserDashboardMain;
  let fixture: ComponentFixture<UserDashboardMain>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserDashboardMain]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserDashboardMain);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
