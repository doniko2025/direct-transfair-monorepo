import { NotificationsService } from './notifications.service';

function makeService(counts: { client: number; merchant: number }) {
  const notification = {
    findMany: jest.fn().mockResolvedValue([]),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    count: jest.fn(async ({ where }: { where: { space: 'client' | 'merchant' } }) => counts[where.space]),
  };
  return { svc: new NotificationsService({ notification } as never), notification };
}

describe('NotificationsService — comptes séparés', () => {
  it('la liste est limitée au compte demandé, et complète sans `space`', async () => {
    const { svc, notification } = makeService({ client: 0, merchant: 0 });
    await svc.findAll('u1', { space: 'merchant' });
    expect(notification.findMany.mock.calls[0][0].where).toMatchObject({ userId: 'u1', space: 'merchant' });
    await svc.findAll('u1');
    expect(notification.findMany.mock.calls[1][0].where).not.toHaveProperty('space');
  });

  it('le compteur donne le compte demandé et le détail des deux boîtes', async () => {
    const { svc } = makeService({ client: 3, merchant: 2 });
    expect(await svc.unreadCount('u1', 'merchant')).toEqual({ count: 2, bySpace: { client: 3, merchant: 2 } });
    expect(await svc.unreadCount('u1', 'client')).toEqual({ count: 3, bySpace: { client: 3, merchant: 2 } });
    expect(await svc.unreadCount('u1')).toEqual({ count: 5, bySpace: { client: 3, merchant: 2 } });
  });

  it('« tout lu » et « tout supprimer » ne touchent que le compte demandé', async () => {
    const { svc, notification } = makeService({ client: 0, merchant: 0 });
    await svc.markAllAsRead('u1', 'client');
    expect(notification.updateMany.mock.calls[0][0].where).toEqual({ userId: 'u1', isRead: false, space: 'client' });
    await svc.deleteMany('u1', { all: true, space: 'merchant' });
    expect(notification.deleteMany.mock.calls[0][0].where).toEqual({ userId: 'u1', space: 'merchant' });
  });
});
