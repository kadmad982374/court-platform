package sy.gov.sla.reports.infrastructure;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import sy.gov.sla.reports.api.CaseSummaryDto;
import sy.gov.sla.reports.api.CaseSummaryDto.CurrencyTotalDto;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Native SQL aggregation for the case-summary report. Mirrors the read-scope
 * shape used by {@code ResolvedRegisterQueryDao} so this module crosses no
 * JpaRepository boundary (D-023).
 */
@Repository
@RequiredArgsConstructor
public class CaseSummaryDao {

    private final NamedParameterJdbcTemplate jdbc;

    /** Mirror of {@code ResolvedRegisterQueryDao.ScopeFilter}, keyed on litigation_cases. */
    public record ScopeFilter(Kind kind, Set<Long> branchIds, Set<Long> branchDeptKeys, Long ownerUserId) {
        public enum Kind { ALL, BRANCHES, BRANCH_DEPT_PAIRS, OWNER_USER, NONE }

        public static ScopeFilter all() { return new ScopeFilter(Kind.ALL, Set.of(), Set.of(), null); }
        public static ScopeFilter none() { return new ScopeFilter(Kind.NONE, Set.of(), Set.of(), null); }
        public static ScopeFilter branches(Set<Long> b) { return new ScopeFilter(Kind.BRANCHES, b, Set.of(), null); }
        public static ScopeFilter branchDeptPairs(Set<Long> keys) { return new ScopeFilter(Kind.BRANCH_DEPT_PAIRS, Set.of(), keys, null); }
        public static ScopeFilter owner(Long uid) { return new ScopeFilter(Kind.OWNER_USER, Set.of(), Set.of(), uid); }
    }

    public CaseSummaryDto query(ScopeFilter scope) {
        long total = countCases(scope);
        Map<String, Long> byOutcome = countByCurrentOutcome(scope);
        Map<String, Long> byLifecycle = countByLifecycle(scope);
        Map<String, Long> byDecisionType = countByDecisionType(scope);
        List<CurrencyTotalDto> adjudged = adjudgedByCurrency(scope);
        return new CaseSummaryDto(total, byOutcome, byLifecycle, byDecisionType, adjudged);
    }

    /**
     * PR-13b — mutually-exclusive bucket per case based on the CURRENT
     * stage's status and decision (not on lifecycle, which double-counts
     * cases whose old stages already had decisions). Sum of values equals
     * {@code totalCases}.
     *
     * Buckets:
     *   - {@code ACTIVE}                — case has no current stage, or its current stage is not FINALIZED.
     *   - {@code RESOLVED_NO_DECISION}  — current stage is FINALIZED but has no decision row.
     *   - {@code FOR_ENTITY|AGAINST_ENTITY|SETTLEMENT|NON_FINAL} — current stage's decision type.
     */
    private Map<String, Long> countByCurrentOutcome(ScopeFilter scope) {
        StringBuilder sql = new StringBuilder("""
                SELECT
                    CASE
                        WHEN cs.id IS NULL                  THEN 'ACTIVE'
                        WHEN cs.stage_status <> 'FINALIZED' THEN 'ACTIVE'
                        WHEN cd.decision_type IS NULL       THEN 'RESOLVED_NO_DECISION'
                        ELSE cd.decision_type
                    END AS k,
                    COUNT(*) AS c
                FROM litigation_cases lc
                LEFT JOIN case_stages cs    ON cs.id = lc.current_stage_id
                LEFT JOIN case_decisions cd ON cd.case_stage_id = cs.id
                WHERE 1=1""");
        MapSqlParameterSource p = new MapSqlParameterSource();
        appendCaseScope(sql, p, scope);
        sql.append(" GROUP BY k");
        Map<String, Long> out = new LinkedHashMap<>();
        jdbc.query(sql.toString(), p, (rs, i) -> {
            out.put(rs.getString("k"), rs.getLong("c"));
            return null;
        });
        return out;
    }

    private long countCases(ScopeFilter scope) {
        StringBuilder sql = new StringBuilder("SELECT COUNT(*) FROM litigation_cases lc WHERE 1=1");
        MapSqlParameterSource p = new MapSqlParameterSource();
        appendCaseScope(sql, p, scope);
        Long c = jdbc.queryForObject(sql.toString(), p, Long.class);
        return c == null ? 0L : c;
    }

    private Map<String, Long> countByLifecycle(ScopeFilter scope) {
        StringBuilder sql = new StringBuilder(
                "SELECT lc.lifecycle_status AS k, COUNT(*) AS c FROM litigation_cases lc WHERE 1=1");
        MapSqlParameterSource p = new MapSqlParameterSource();
        appendCaseScope(sql, p, scope);
        sql.append(" GROUP BY lc.lifecycle_status");
        Map<String, Long> out = new LinkedHashMap<>();
        jdbc.query(sql.toString(), p, (rs, i) -> {
            out.put(rs.getString("k"), rs.getLong("c"));
            return null;
        });
        return out;
    }

    private Map<String, Long> countByDecisionType(ScopeFilter scope) {
        StringBuilder sql = new StringBuilder("""
                SELECT cd.decision_type AS k, COUNT(*) AS c
                FROM case_decisions cd
                JOIN case_stages cs ON cs.id = cd.case_stage_id
                JOIN litigation_cases lc ON lc.id = cs.litigation_case_id
                WHERE 1=1""");
        MapSqlParameterSource p = new MapSqlParameterSource();
        appendCaseScope(sql, p, scope);
        sql.append(" GROUP BY cd.decision_type");
        Map<String, Long> out = new LinkedHashMap<>();
        jdbc.query(sql.toString(), p, (rs, i) -> {
            out.put(rs.getString("k"), rs.getLong("c"));
            return null;
        });
        return out;
    }

    private List<CurrencyTotalDto> adjudgedByCurrency(ScopeFilter scope) {
        StringBuilder sql = new StringBuilder("""
                SELECT cd.currency_code AS cc, COALESCE(SUM(cd.adjudged_amount), 0) AS s
                FROM case_decisions cd
                JOIN case_stages cs ON cs.id = cd.case_stage_id
                JOIN litigation_cases lc ON lc.id = cs.litigation_case_id
                WHERE cd.adjudged_amount IS NOT NULL""");
        MapSqlParameterSource p = new MapSqlParameterSource();
        appendCaseScope(sql, p, scope);
        sql.append(" GROUP BY cd.currency_code ORDER BY s DESC");
        List<CurrencyTotalDto> out = new ArrayList<>();
        jdbc.query(sql.toString(), p, (rs, i) -> {
            BigDecimal total = rs.getBigDecimal("s");
            if (total == null) total = BigDecimal.ZERO;
            out.add(new CurrencyTotalDto(rs.getString("cc"), total));
            return null;
        });
        return out;
    }

    /** Appends the scope predicate against {@code lc.*}. */
    private static void appendCaseScope(StringBuilder sql, MapSqlParameterSource p, ScopeFilter scope) {
        switch (scope.kind()) {
            case ALL -> { /* no extra clause */ }
            case BRANCHES -> {
                if (scope.branchIds().isEmpty()) sql.append(" AND 1=0");
                else {
                    sql.append(" AND lc.created_branch_id IN (:scopeBranches)");
                    p.addValue("scopeBranches", scope.branchIds());
                }
            }
            case BRANCH_DEPT_PAIRS -> {
                if (scope.branchDeptKeys().isEmpty()) sql.append(" AND 1=0");
                else {
                    sql.append(" AND (lc.created_branch_id * 1000000 + lc.created_department_id) IN (:scopeKeys)");
                    p.addValue("scopeKeys", scope.branchDeptKeys());
                }
            }
            case OWNER_USER -> {
                sql.append(" AND lc.current_owner_user_id = :ownerUserId");
                p.addValue("ownerUserId", scope.ownerUserId());
            }
            case NONE -> sql.append(" AND 1=0");
        }
    }
}
