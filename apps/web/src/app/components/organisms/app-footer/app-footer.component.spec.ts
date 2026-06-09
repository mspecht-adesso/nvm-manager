import { TestBed } from '@angular/core/testing';
import { AppFooterComponent } from './app-footer.component';

/**
 * Unit tests for {@link AppFooterComponent}.
 *
 * Verifies the footer renders the current year and the external GitHub /
 * license links, and that those links open safely in a new tab
 * (`target="_blank"` + `rel="noopener noreferrer"`).
 */
describe('AppFooterComponent', () => {
  /** Compiles the standalone component and returns the fixture + instance. */
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AppFooterComponent],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppFooterComponent);
    return { fixture, comp: fixture.componentInstance };
  }

  it('erstellt die Komponente', async () => {
    const { comp } = await setup();
    expect(comp).toBeTruthy();
  });

  it('rendert das Footer-Element', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.querySelector('footer')).toBeTruthy();
  });

  it('zeigt das aktuelle Jahr an', async () => {
    const { fixture, comp } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain(String(comp.year));
  });

  it('enthält den MIT-License-Link', async () => {
    const { fixture, comp } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const links = el.querySelectorAll<HTMLAnchorElement>('a');
    const licenseLink = Array.from(links).find((a) => a.href === comp.licenseUrl);
    expect(licenseLink).toBeTruthy();
    expect(licenseLink?.textContent?.trim()).toBe('MIT License');
  });

  it('enthält den GitHub-Link', async () => {
    const { fixture, comp } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const links = el.querySelectorAll<HTMLAnchorElement>('a');
    const githubLink = Array.from(links).find((a) => a.href === comp.githubUrl);
    expect(githubLink).toBeTruthy();
    expect(githubLink?.textContent?.trim()).toContain('GitHub');
  });

  it('öffnet Links in einem neuen Tab', async () => {
    const { fixture } = await setup();
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    const links = el.querySelectorAll<HTMLAnchorElement>('a');
    links.forEach((link) => {
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    });
  });
});
