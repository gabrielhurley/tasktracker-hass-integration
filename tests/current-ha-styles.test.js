import { TaskTrackerBaseCard } from '../custom_components/tasktracker/www/utils/base-card.js';
import { TaskTrackerStyles } from '../custom_components/tasktracker/www/utils/styles.js';

class TestTaskTrackerCard extends TaskTrackerBaseCard {
  getCardTitle() { return 'Test'; }
  _renderContent() { return '<div class="task-item">Task</div>'; }
}

describe('current Home Assistant card styling', () => {
  beforeAll(() => {
    if (!customElements.get('test-tasktracker-card')) {
      customElements.define('test-tasktracker-card', TestTaskTrackerCard);
    }
  });

  test('uses ha-card as the visual shell', () => {
    const card = document.createElement('test-tasktracker-card');
    card.setConfig({ show_header: true });

    expect(card.shadowRoot.querySelector('ha-card.card')).not.toBeNull();
    expect(card.shadowRoot.querySelector('div.card')).toBeNull();
  });

  test('uses current semantic neutral tokens for shared surfaces', () => {
    const styles = TaskTrackerStyles.getCommonCardStyles();

    expect(styles).toContain('--ha-color-fill-neutral-normal-resting');
    expect(styles).toContain('--ha-color-fill-neutral-normal-hover');
    expect(styles).toContain('--ha-color-border-neutral-quiet');
    expect(styles).not.toContain('--secondary-background-color');
    expect(styles).not.toContain('--card-background-color');
  });

  test('does not override the ha-card frame owned by Home Assistant', () => {
    const styles = TaskTrackerStyles.getCommonCardStyles();
    const cardRule = styles.match(/\.card\s*\{([^}]*)\}/)?.[1] || '';

    expect(cardRule).not.toMatch(/background\s*:/);
    expect(cardRule).not.toMatch(/border(?:-radius)?\s*:/);
    expect(cardRule).not.toMatch(/box-shadow\s*:/);
  });
});
