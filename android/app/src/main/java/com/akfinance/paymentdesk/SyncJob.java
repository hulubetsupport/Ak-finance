package com.akfinance.paymentdesk;

import android.app.job.JobParameters;
import android.app.job.JobService;

public class SyncJob extends JobService {
    @Override
    public boolean onStartJob(final JobParameters p) {
        new Thread(() -> {
            int left = Sync.run(this);
            jobFinished(p, false);
            if (left > 0) {
                Sync.schedule(this);
            }
        }).start();
        return true;
    }

    @Override
    public boolean onStopJob(JobParameters p) {
        return true;
    }
}
