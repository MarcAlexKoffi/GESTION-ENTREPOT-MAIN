import { ComponentFixture, TestBed } from '@angular/core/testing';

import { UserHistorique } from './user-historique';

describe('UserHistorique', () => {
  let component: UserHistorique;
  let fixture: ComponentFixture<UserHistorique>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UserHistorique]
    })
    .compileComponents();

    fixture = TestBed.createComponent(UserHistorique);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
