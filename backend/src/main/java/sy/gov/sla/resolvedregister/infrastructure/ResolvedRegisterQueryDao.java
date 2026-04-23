package sy.gov.sla.resolvedregister.infrastructure;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;
import sy.gov.sla.resolvedregister.api.ResolvedRegisterEntryDto;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * استعلام Read Model للسجل الشهري للفصل. مرجع: D-025.
 *
 * native SQL مقصود لأن الوحدة هي query module عبر حدود ثلاث وحدات
 * (litigationregistration / decisionfinalization / organization)؛
 * لا يستخدم أي JpaRepository من تلك الوحدات (احترام D-023 على مستوى الكود).
 */
@Repository
@RequiredArgsConstructor
public class ResolvedRegisterQueryDao {

    private final NamedParameterJdbcTemplate jdbc;

    private static final String BASE_SQL = """
        SELECT
            lc.id                            AS case_id,
            cs.id                            AS stage_id,
            cd.id                            AS decision_id,
            lc.public_entity_name            AS public_entity_name,
            lc.public_entity_position        AS public_entity_position,
            lc.opponent_name                 AS opponent_name,
            lc.created_branch_id             AS branch_id,
            b.name_ar                        AS branch_name,
            lc.created_department_id         AS department_id,
            d.type                           AS department_type,
            lc.created_court_id              AS court_id,
            c.name_ar                        AS court_name,
            cs.stage_basis_number            AS stage_basis_number,
            cs.stage_year                    AS stage_year,
            cd.decision_number               AS decision_number,
            cd.decision_date                 AS decision_date,
            cd.decision_type                 AS decision_type,
            cd.adjudged_amount               AS adjudged_amount,
            cd.currency_code                 AS currency_code,
            cd.summary_notes                 AS summary_notes,
            lc.lifecycle_status              AS lifecycle_status,
            cs.stage_status                  AS stage_status
        FROM case_decisions cd
        JOIN case_stages     cs ON cs.id = cd.case_stage_id
        JOIN litigation_cases lc ON lc.id = cs.litigation_case_id
        JOIN branches        b  ON b.id  = lc.created_branch_id
        JOIN departments     d  ON d.id  = lc.created_department_id
        JOIN courts          c  ON c.id  = lc.created_court_id
        """;

    public List<ResolvedRegisterEntryDto> query(QueryFilter filter, ScopeFilter scope) {
        StringBuilder sql = new StringBuilder(BASE_SQL).append(" WHERE 1=1");
        MapSqlParameterSource p = new MapSqlParameterSource();

        if (filter.year() != null) {
            sql.append(" AND EXTRACT(YEAR FROM cd.decision_date) = :year");
            p.addValue("year", filter.year());
        }
        if (filter.month() != null) {
            sql.append(" AND EXTRACT(MONTH FROM cd.decision_date) = :month");
            p.addValue("month", filter.month());
        }
        if (filter.branchId() != null) {
            sql.append(" AND lc.created_branch_id = :branchId");
            p.addValue("branchId", filter.branchId());
        }
        if (filter.departmentId() != null) {
            sql.append(" AND lc.created_department_id = :departmentId");
            p.addValue("departmentId", filter.departmentId());
        }
        if (filter.decisionType() != null) {
            sql.append(" AND cd.decision_type = :decisionType");
            p.addValue("decisionType", filter.decisionType());
        }

        // Read scope (D-021/D-025).
        switch (scope.kind()) {
            case ALL -> { /* لا قيد */ }
            case BRANCHES -> {
                if (scope.branchIds().isEmpty()) {
                    sql.append(" AND 1=0");
                } else {
                    sql.append(" AND lc.created_branch_id IN (:scopeBranches)");
                    p.addValue("scopeBranches", scope.branchIds());
                }
            }
            case BRANCH_DEPT_PAIRS -> {
                if (scope.branchDeptKeys().isEmpty()) {
                    sql.append(" AND 1=0");
                } else {
                    // (branch_id * 1_000_000 + department_id) IN (...) — كود مركّب آمن
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

        sql.append(" ORDER BY cd.decision_date DESC, lc.id DESC");

        return jdbc.query(sql.toString(), p, (rs, i) -> new ResolvedRegisterEntryDto(
                rs.getLong("case_id"),
                rs.getLong("stage_id"),
                rs.getLong("decision_id"),
                rs.getString("public_entity_name"),
                rs.getString("public_entity_position"),
                rs.getString("opponent_name"),
                rs.getLong("branch_id"),
                rs.getString("branch_name"),
                rs.getLong("department_id"),
                rs.getString("department_type"),
                rs.getLong("court_id"),
                rs.getString("court_name"),
                rs.getString("stage_basis_number"),
                (Integer) rs.getObject("stage_year"),
                rs.getString("decision_number"),
                rs.getDate("decision_date").toLocalDate(),
                rs.getString("decision_type"),
                rs.getBigDecimal("adjudged_amount"),
                rs.getString("currency_code"),
                rs.getString("summary_notes"),
                rs.getString("lifecycle_status"),
                rs.getString("stage_status")
        ));
    }

    public record QueryFilter(Integer year, Integer month, Long branchId,
                              Long departmentId, String decisionType) {}

    public record ScopeFilter(Kind kind, Set<Long> branchIds, Set<Long> branchDeptKeys, Long ownerUserId) {
        public enum Kind { ALL, BRANCHES, BRANCH_DEPT_PAIRS, OWNER_USER, NONE }

        public static ScopeFilter all() { return new ScopeFilter(Kind.ALL, Set.of(), Set.of(), null); }
        public static ScopeFilter none() { return new ScopeFilter(Kind.NONE, Set.of(), Set.of(), null); }
        public static ScopeFilter branches(Set<Long> b) { return new ScopeFilter(Kind.BRANCHES, b, Set.of(), null); }
        public static ScopeFilter branchDeptPairs(Set<Long> keys) { return new ScopeFilter(Kind.BRANCH_DEPT_PAIRS, Set.of(), keys, null); }
        public static ScopeFilter owner(Long uid) { return new ScopeFilter(Kind.OWNER_USER, Set.of(), Set.of(), uid); }
    }

    @SuppressWarnings("unused")
    private static List<Object> empty() { return new ArrayList<>(); }
}

